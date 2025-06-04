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
  const [agentId] = useQueryState("agentId");
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

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

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
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const content = (formData.get("input") as string | undefined)?.trim() ?? "";

    setHasInput(false);
    if (!agentId) return;
    if (
      (content.trim().length === 0 && contentBlocks.length === 0) ||
      isLoading
    )
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: LangGraphMessage = { // Assuming existing messages are LangGraphMessage type
      id: uuidv4(),
      type: "human",
      content: [
        ...(content.trim().length > 0 ? [{ type: "text", text: content }] : []),
        ...contentBlocks,
      ] as LangGraphMessage["content"],
    };

    // TODO: Determine agent type (e.g., 'langgraph' or 'adk')
    // This might involve:
    // 1. Fetching the agent details from useAgentsContext().agents using the current `agentId`.
    // 2. The `agents` array would need to include a `type` field or similar.
    // For now, let's assume a variable `currentAgentType` and `currentAgentIdForAPI` exist.
    // const currentAgent = agents.find(a => a.id === agentId); // This agentId is assistant_id for LangGraph
    // const currentAgentType = currentAgent?.type; // Hypothetical: 'langgraph' | 'adk'
    // const currentAgentIdForAPI = agentId; // For LangGraph, this is assistant_id. For ADK, this would be AdkAgentStoredData.id

    const currentAgentType = agentId === "adk-test-agent" ? "adk" : "langgraph"; // Placeholder for type detection
    const currentAgentIdForAPI = agentId; // This needs to be the actual ADK agent ID if type is 'adk'

    if (currentAgentType === "adk") {
      // TODO: Ensure currentAgentIdForAPI is the ADK agent's stored ID (e.g., from AdkAgentStoredData.id)
      console.log(`Sending message to ADK Agent (${currentAgentIdForAPI}) with input: ${content}`);

      // Add human message to UI immediately (optimistic update)
      // This part needs to be adapted to how messages are stored and rendered.
      // For now, assuming stream.messages can be updated or a similar local state.
      // stream.updateMessages([...stream.messages, newHumanMessage]); // Placeholder for UI update

      fetch(`/api/adk-agents/${currentAgentIdForAPI}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: content, acceptedOutputModes: ['text/plain', 'application/json'] }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || `Error invoking ADK agent: ${response.statusText}`) });
        }
        return response.json();
      })
      .then((adkResponse: A2ATask | A2AMessage) => {
        console.log("ADK Agent Response:", adkResponse);
        letresponseText = "Could not extract text from ADK response.";
        if (adkResponse.kind === "task" && adkResponse.status?.message?.parts) {
          responseText = adkResponse.status.message.parts
            .filter((part: A2APart) => part.kind === 'text' && typeof (part as any).text === 'string')
            .map((part: A2APart) => (part as any).text)
            .join("\n");
        } else if (adkResponse.kind === "task" && adkResponse.artifacts && adkResponse.artifacts.length > 0 && adkResponse.artifacts[0].parts) {
          // Fallback to first artifact if status message is not present
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
        // TODO: Handle other part kinds (e.g., images, data) from A2A response.
        // TODO: Construct an appropriate AI message object and add it to the chat display.
        // This might involve calling a function like `stream.addMessage()` or updating local state.
        // Example:
        // const newAiMessage: LangGraphMessage = { id: uuidv4(), type: 'ai', content: [{type: "text", text: responseText}] };
        // stream.updateMessages([...stream.messages, newAiMessage]); // Placeholder for UI update
        toast.info(`ADK Response: ${responseText.substring(0,100)}...`);
      })
      .catch(error => {
        console.error("Error invoking ADK agent:", error);
        toast.error(`Failed to get response from ADK agent: ${error.message}`);
        // TODO: Potentially add an error message to the chat UI.
      });

    } else { // Default to existing LangGraph logic
      const toolMessages = ensureToolCallsHaveResponses(stream.messages);
      const { getAgentConfig } = useConfigStore.getState();

      stream.submit(
        { messages: [...toolMessages, newHumanMessage] },
        {
          streamMode: ["values"],
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              ...toolMessages,
              newHumanMessage,
            ],
          }),
          config: {
            configurable: getAgentConfig(agentId), // agentId here is LangGraph's assistant_id
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
    optimisticValues?: (prev: { messages?: LangGraphMessage[] }) => { // Ensure type consistency
      messages?: LangGraphMessage[] | undefined;
    },
  ) => {
    if (!agentId) return;
    const { getAgentConfig } = useConfigStore.getState();

    // Do this so the loading state is correct
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
