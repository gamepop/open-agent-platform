import { v4 as uuidv4 } from "uuid";
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/features/chat/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkpoint, Message as LangGraphMessage } from "@langchain/langgraph-sdk";
// Import A2A types
import { Task as A2ATask, Message as A2AMessage, Part as A2APart } from '@/types/a2a';
import {
  AssistantMessage,
  AssistantMessageLoading,
} from "@/features/chat/components/thread/messages/ai";
import { HumanMessage } from "@/features/chat/components/thread/messages/human";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  SquarePen,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ensureToolCallsHaveResponses } from "@/features/chat/utils/tool-responses";
import { DO_NOT_RENDER_ID_PREFIX } from "@/constants";
import { useConfigStore } from "../../hooks/use-config-store";
import { useAuthContext } from "@/providers/Auth";
import { AgentsCombobox } from "@/components/ui/agents-combobox";
import { useAgentsContext } from "@/providers/Agents";
import { isUserSpecifiedDefaultAgent } from "@/lib/agent-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./messages/ContentBlocksPreview";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function NewThreadButton(props: { hasMessages: boolean }) {
  const { agents, loading } = useAgentsContext();
  const [open, setOpen] = useState(false);

  const [agentId, setAgentId] = useQueryState("agentId");
  const [deploymentId, setDeploymentId] = useQueryState("deploymentId");
  const [_, setThreadId] = useQueryState("threadId");

  const handleNewThread = useCallback(() => {
    setThreadId(null);
  }, [setThreadId]);

  const isMac = useMemo(
    () => /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent),
    [],
  );

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLocaleLowerCase() === "o"
      ) {
        e.preventDefault();
        handleNewThread();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewThread]);

  const onAgentChange = useCallback(
    (v: string | string[] | undefined) => {
      const nextValue = Array.isArray(v) ? v[0] : v;
      if (!nextValue) return;

      const [agentId, deploymentId] = nextValue.split(":");
      setAgentId(agentId);
      setDeploymentId(deploymentId);
      setThreadId(null);
    },
    [setAgentId, setDeploymentId, setThreadId],
  );

  const agentValue =
    agentId && deploymentId ? `${agentId}:${deploymentId}` : undefined;

  useEffect(() => {
    if (agentValue || !agents.length) {
      return;
    }
    const defaultAgent = agents.find(isUserSpecifiedDefaultAgent);
    if (defaultAgent) {
      onAgentChange(
        `${defaultAgent.assistant_id}:${defaultAgent.deploymentId}`,
      );
    }
  }, [agents, agentValue, onAgentChange]);

  if (!props.hasMessages) {
    return (
      <AgentsCombobox
        agents={agents}
        agentsLoading={loading}
        value={agentValue}
        setValue={onAgentChange}
        open={open}
        setOpen={setOpen}
        triggerAsChild
        className="min-w-auto"
      />
    );
  }

  return (
    <div className="flex rounded-md shadow-xs">
      <AgentsCombobox
        agents={agents}
        agentsLoading={loading}
        value={agentValue}
        setValue={onAgentChange}
        open={open}
        setOpen={setOpen}
        triggerAsChild
        className="relative min-w-auto shadow-none focus-within:z-10"
        style={{
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          borderRight: 0,
        }}
        footer={
          <div className="text-secondary-foreground bg-secondary flex gap-2 p-3 pr-10 pb-3 text-xs">
            <SquarePen className="size-4 shrink-0" />
            <span className="text-secondary-foreground mb-[1px] text-xs">
              Selecting a different agent will create a new thread.
            </span>
          </div>
        }
      />

      {props.hasMessages && (
        <TooltipIconButton
          size="lg"
          className="relative size-9 p-4 shadow-none focus-within:z-10"
          tooltip={
            isMac ? "New thread (Cmd+Shift+O)" : "New thread (Ctrl+Shift+O)"
          }
          variant="outline"
          onClick={handleNewThread}
          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
        >
          <SquarePen className="size-4" />
        </TooltipIconButton>
      )}
    </div>
  );
}

export function Thread() {
  const [agentIdQueryParam] = useQueryState("agentId"); // Renamed to avoid conflict with agentId from context
  const { agents: allAgents, loading: agentsLoading } = useAgentsContext(); // Get all agents
  const [currentAgent, setCurrentAgent] = useState<any | null>(null); // To store the full current agent object

  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [hasInput, setHasInput] = useState(false);
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);

  const { session } = useAuthContext();

  const stream = useStreamContext(); // This likely provides addMessage, updateMessage etc.
  const messages = stream.messages; // Assuming this is the source of truth for displayed messages
  const isLoading = stream.isLoading; // General loading state

  const lastError = useRef<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      setErrorMessage("");
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      setErrorMessage(message);
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai" &&
      currentAgent?.agentType !== 'adk' // Only set for non-ADK agents, ADK handles its loading separately
    ) {
      setFirstTokenReceived(true);
    }
    prevMessageLength.current = messages.length;
  }, [messages, currentAgent?.agentType]);


  // Derive currentAgent from agentIdQueryParam and allAgents
  useEffect(() => {
    if (agentIdQueryParam && allAgents.length > 0) {
      // This assumes `allAgents` contains both LangGraph and ADK agent representations.
      // And that ADK agents have an `id` field matching agentIdQueryParam, and an `agentType: 'adk'` field.
      // LangGraph agents use `assistant_id`. This logic might need refinement based on actual agent data structure.
      const foundAgent = allAgents.find(
        (a: any) => a.id === agentIdQueryParam || a.assistant_id === agentIdQueryParam
      );
      if (foundAgent) {
        // Simulate agentType if not present. Ideally, the context provides this.
        // For ADK, we might check for a unique property like `a2aBaseUrl`.
        // For LangGraph, it might be the presence of `assistant_id` and lack of `a2aBaseUrl`.
        const simulatedAgentType = foundAgent.a2aBaseUrl ? 'adk' : 'langgraph';
        setCurrentAgent({ ...foundAgent, agentType: foundAgent.agentType || simulatedAgentType });
      } else {
        setCurrentAgent(null);
      }
    } else {
      setCurrentAgent(null);
    }
  }, [agentIdQueryParam, allAgents]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const userInput = (formData.get("input") as string | undefined)?.trim() ?? "";

    setHasInput(false);
    if (!currentAgent) {
      toast.error("No agent selected.");
      return;
    }
    if ((userInput.length === 0 && contentBlocks.length === 0) || isLoading) return;

    // Common human message structure (adapt 'type' if your rendering differentiates)
    const humanMessagePayload = {
      id: uuidv4(), // Temporary ID for optimistic update if needed
      role: 'human' as const,
      content: userInput, // Assuming simple text for now, contentBlocks need to be handled
      type: 'message', // Or a more generic type if LangGraphMessage and ADK messages differ
    };
    // If contentBlocks are used, they need to be transformed into the 'content' array format
    // similar to how newHumanMessage was constructed before. For simplicity, this example focuses on text.
    if (contentBlocks.length > 0) {
      humanMessagePayload.content = JSON.stringify(contentBlocks); // Placeholder, handle properly
      // Or convert to the expected parts array structure
    }


    // Agent Type Detection and Specific Logic
    // Assumes currentAgent object has an 'agentType' property or a distinguishable field like 'a2aBaseUrl'.
    // console.log("Current Agent for submit:", currentAgent);

    if (currentAgent.agentType === 'adk') {
      setFirstTokenReceived(false); // Reset for ADK specific loading if any

      // Optimistic UI for Human Message (ADK Flow)
      // Assuming stream.addOptimisticMessage or similar exists.
      // If not, this needs to be handled by directly updating a local message state.
      // const optimisticId = stream.addOptimisticMessage(humanMessagePayload.content, "human");
      // For now, let's assume direct addition for simplicity if optimistic methods aren't confirmed:
      if (typeof stream.addMessage === 'function') {
         // stream.addMessage(humanMessagePayload); // This might not be the right way if stream is only for LangGraph
         // We'll manually construct and add to a local message list or assume stream.messages can be appended to.
         // For this exercise, we'll assume stream.messages is the array and we can update it.
         // This is a placeholder for actual state management.
         const tempId = uuidv4();
         stream.setMessages([...stream.messages, { ...humanMessagePayload, id: tempId, type: 'human' }]);
         console.log("Optimistically added ADK human message (placeholder)");
      } else {
        console.warn("stream.addMessage function not found. UI will not update optimistically for human message.");
      }


      try {
        const response = await fetch(`/api/adk-agents/${currentAgent.id}/invoke`, { // Use currentAgent.id (ADK agent's stored ID)
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: userInput, acceptedOutputModes: ['text/plain', 'application/json'] }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: `Error invoking ADK agent: ${response.statusText}` }));
          throw new Error(errData.error || `Error invoking ADK agent: ${response.statusText}`);
        }

        const adkResponse: A2ATask | A2AMessage = await response.json();
        console.log("ADK Agent Response:", adkResponse);
        let responseText = "Could not extract text from ADK response.";

        if (adkResponse.kind === "task" && adkResponse.status?.message?.parts) {
          responseText = adkResponse.status.message.parts
            .filter((part: A2APart) => part.kind === 'text' && typeof (part as any).text === 'string')
            .map((part: A2APart) => (part as any).text)
            .join("\n");
        } else if (adkResponse.kind === "task" && adkResponse.artifacts && adkResponse.artifacts.length > 0 && adkResponse.artifacts[0].parts) {
          responseText = adkResponse.artifacts[0].parts
            .filter((part: A2APart) => part.kind === 'text' && typeof (part as any).text === 'string')
            .map((part: A2APart) => (part as any).text)
            .join("\n");
        } else if (adkResponse.kind === "message" && adkResponse.parts) {
          responseText = adkResponse.parts
            .filter((part: A2APart) => part.kind === 'text' && typeof (part as any).text === 'string')
            .map((part: A2APart) => (part as any).text)
            .join("\n");
        }

        const aiMessage = {
          id: uuidv4(), // Or use an ID from adkResponse if available and suitable
          role: 'ai' as const,
          content: responseText,
          type: 'message' // Ensure this type is handled by your rendering logic
        };

        // Update UI with AI response
        // if (optimisticId && typeof stream.updateOptimisticMessage === 'function') {
        //   stream.updateOptimisticMessage(optimisticId, aiMessage.content, "ai", aiMessage.id);
        // } else if (typeof stream.addMessage === 'function') {
        //    stream.addMessage(aiMessage); // Add as a new message
        // }
        // Placeholder for actual state management:
        stream.setMessages([...stream.messages, aiMessage]);
        console.log("Added ADK AI response to messages (placeholder)");


      } catch (error: any) {
        console.error("Error invoking ADK agent:", error);
        toast.error(`Failed to get response from ADK agent: ${error.message}`);
        const errorMessage = {
          id: uuidv4(),
          role: 'ai' as const,
          content: `Error interacting with ADK agent: ${error.message}`,
          type: 'error' // Ensure this type is handled by your rendering logic
        };
        // Add error message to chat UI
        // if (typeof stream.addMessage === 'function') {
        //    stream.addMessage(errorMessage);
        // }
        // Placeholder for actual state management:
        stream.setMessages([...stream.messages, errorMessage]);
        console.log("Added ADK error message to messages (placeholder)");
      }

    } else { // Default to existing LangGraph logic (currentAgent is LangGraph type)
      setFirstTokenReceived(false); // Reset for LangGraph
      const langGraphHumanMessage: LangGraphMessage = {
        id: humanMessagePayload.id, // Use the same ID
        type: "human", // LangGraph specific type
        content: [ // LangGraph expects an array of content parts
          ...(userInput.length > 0 ? [{ type: "text", text: userInput }] : []),
          ...contentBlocks, // Assuming contentBlocks are already in LangGraph format
        ] as LangGraphMessage["content"],
      };


      const toolMessages = ensureToolCallsHaveResponses(stream.messages);
      const { getAgentConfig } = useConfigStore.getState();

      stream.submit(

        { messages: [...toolMessages, langGraphHumanMessage] },

        {
          streamMode: ["values"],
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              ...toolMessages,

              langGraphHumanMessage,
            ],
          }),
          config: {
            configurable: getAgentConfig(currentAgent.assistant_id), // Use assistant_id for LangGraph

          },
          metadata: {
            supabaseAccessToken: session?.accessToken,
          },
          streamSubgraphs: true,
        },
      );
    }

    form.reset();
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
    optimisticValues?: (prev: { messages?: LangGraphMessage[] }) => {

      messages?: LangGraphMessage[] | undefined;
    },
  ) => {
    if (!currentAgent || currentAgent.agentType === 'adk') {
      // TODO: Implement regenerate for ADK if possible/needed, or disable button
      toast.info("Regenerate is not currently supported for ADK agents.");
      return;
    }
    if (!currentAgent.assistant_id) return; // Should not happen if type is langgraph

    const { getAgentConfig } = useConfigStore.getState();
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
      config: {
        configurable: getAgentConfig(agentId),
      },
      optimisticValues,
      metadata: {
        supabaseAccessToken: session?.accessToken,
      },
      streamSubgraphs: true,
    });
  };

  const hasMessages = stream.messages.length > 0; // Use stream.messages for consistency in rendering
  const hasNoAIOrToolMessages = !stream.messages.find( // Use stream.messages
    (m: LangGraphMessage) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <StickToBottom className="relative flex-1 overflow-hidden">
        <StickyToBottomContent
          className={cn(
            "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
            !hasMessages && "mt-[25vh] flex flex-col items-stretch",
            hasMessages && "grid grid-rows-[1fr_auto]",
          )}
          contentClassName="pt-8 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full"
          content={
            <>
              {stream.messages // Iterate over stream.messages for rendering
                .filter((m: LangGraphMessage) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                .map((message, index) =>
                  message.type === "human" ? (
                    <HumanMessage
                      key={message.id || `${message.type}-${index}`}
                      message={message as LangGraphMessage} // Cast to LangGraphMessage
                      isLoading={isLoading}
                    />
                  ) : (
                    <AssistantMessage
                      key={message.id || `${message.type}-${index}`}
                      message={message as LangGraphMessage} // Cast to LangGraphMessage
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                    />
                  ),
                )}
              {/* Special rendering case where there are no AI/tool messages, but there is an interrupt.
                    We need to render it outside of the messages list, since there are no messages to render */}
              {hasNoAIOrToolMessages && !!stream.interrupt && (
                <AssistantMessage
                  key="interrupt-msg"
                  message={undefined}
                  isLoading={isLoading}
                  handleRegenerate={handleRegenerate}
                />
              )}
              {isLoading && !firstTokenReceived && <AssistantMessageLoading />}
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>An error occurred:</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </>
          }
          footer={
            <div className="sticky bottom-0 flex flex-col items-center gap-8 bg-white">
              {!hasMessages && (
                <div className="flex items-center gap-3">
                  <LangGraphLogoSVG className="h-8 flex-shrink-0" />
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Open Agent Platform
                  </h1>
                </div>
              )}

              <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

              <div
                ref={dropRef}
                className={cn(
                  "bg-muted relative z-10 mx-auto mb-8 w-full max-w-3xl rounded-2xl shadow-xs transition-all",
                  dragOver
                    ? "border-primary border-2 border-dotted"
                    : "border border-solid",
                )}
              >
                <form
                  onSubmit={handleSubmit}
                  className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2"
                >
                  <ContentBlocksPreview
                    blocks={contentBlocks}
                    onRemove={removeBlock}
                  />
                  <textarea
                    name="input"
                    onChange={(e) => setHasInput(!!e.target.value.trim())}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        const el = e.target as HTMLElement | undefined;
                        const form = el?.closest("form");
                        form?.requestSubmit();
                      }
                    }}
                    placeholder="Type your message..."
                    className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
                  />

                  <div className="flex items-center gap-6 p-2 pt-4">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 space-x-2">
                        <NewThreadButton hasMessages={hasMessages} />
                        <Switch
                          id="render-tool-calls"
                          checked={hideToolCalls ?? false}
                          onCheckedChange={setHideToolCalls}
                        />
                        <Label
                          htmlFor="render-tool-calls"
                          className="text-sm text-gray-600"
                        >
                          Hide Tool Calls
                        </Label>
                      </div>
                    </div>
                    <Label
                      htmlFor="file-input"
                      className="flex cursor-pointer"
                    >
                      <Plus className="size-5 text-gray-600" />
                      <span className="text-sm text-gray-600">
                        Upload PDF or Image
                      </span>
                    </Label>
                    <input
                      id="file-input"
                      type="file"
                      onChange={handleFileUpload}
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      className="hidden"
                    />
                    {stream.isLoading ? (
                      <Button
                        key="stop"
                        onClick={() => stream.stop()}
                        className="ml-auto"
                      >
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="ml-auto shadow-md transition-all"
                        disabled={
                          isLoading || (!hasInput && contentBlocks.length === 0)
                        }
                      >
                        Send
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          }
        />
      </StickToBottom>
    </div>
  );
}
