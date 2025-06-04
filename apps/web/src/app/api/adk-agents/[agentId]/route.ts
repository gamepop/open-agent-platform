import { NextRequest, NextResponse } from 'next/server';
import { AdkAgentRegistrationPayload, AdkAgentStoredData, AgentCard } from '@/types/adk-agent';

// TODO: Replace with actual database interactions

interface RouteParams {
  params: {
    agentId: string;
  };
}

/**
 * @swagger
 * /api/adk-agents/{agentId}:
 *   get:
 *     summary: Get a specific ADK agent by ID
 *     tags: [ADK Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ADK agent
 *     responses:
 *       200:
 *         description: The ADK agent data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdkAgentStoredData'
 *       404:
 *         description: ADK Agent not found
 *       500:
 *         description: Internal server error
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = params;
    // TODO: Fetch ADK agent with agentId from database
    console.log(`Fetching ADK agent with ID: ${agentId}`);
    // Placeholder: Simulate fetching data
    if (agentId === "existing-uuid") {
      const agent: AdkAgentStoredData = {
        id: agentId,
        name: "Fetched Agent",
        a2aBaseUrl: "http://example.com/agent",
        agentCard: { name: "Fetched Agent Card", url: "http://example.com/agent" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(agent);
    }
    return NextResponse.json({ error: "Not found (placeholder)" }, { status: 404 });
  } catch (error) {
    console.error(`Error fetching ADK agent ${params.agentId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch ADK agent' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/adk-agents/{agentId}:
 *   put:
 *     summary: Update an existing ADK agent
 *     tags: [ADK Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ADK agent to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object # Can be a partial AdkAgentRegistrationPayload or AdkAgentStoredData
 *             properties:
 *               name:
 *                 type: string
 *               a2aBaseUrl:
 *                 type: string
 *               authentication:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [apikey, bearer]
 *                   token:
 *                     type: string
 *     responses:
 *       200:
 *         description: ADK Agent updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 agent:
 *                   $ref: '#/components/schemas/AdkAgentStoredData' # Or a partial update response
 *       400:
 *         description: Invalid payload or failed to fetch/validate Agent Card if URL changed
 *       404:
 *         description: ADK Agent not found
 *       500:
 *         description: Internal server error
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = params;
    const body = await req.json(); // Should be Partial<AdkAgentRegistrationPayload> or similar

    // TODO: Fetch ADK agent with agentId from database
    console.log(`Attempting to update ADK agent with ID: ${agentId}`, body);
    // Placeholder: Simulate fetching and updating
    if (agentId !== "existing-uuid") {
      return NextResponse.json({ error: "Not found (placeholder) to update" }, { status: 404 });
    }

    // TODO: Validate payload
    // TODO: If a2aBaseUrl changed, re-fetch and re-validate Agent Card
    if (body.a2aBaseUrl) {
        const newAgentCardUrl = `${body.a2aBaseUrl.replace(/\/$/, "")}/.well-known/agent.json`;
        console.log(`Agent Card URL would be re-fetched from: ${newAgentCardUrl} if it changed.`);
        // const fetchedCardResponse = await fetch(newAgentCardUrl);
        // if (!fetchedCardResponse.ok) {
        //   return NextResponse.json({ error: `Failed to fetch Agent Card from ${newAgentCardUrl}. Status: ${fetchedCardResponse.status}` }, { status: 400 });
        // }
        // const newAgentCard: AgentCard = await fetchedCardResponse.json();
        // TODO: Validate newAgentCard
        // currentAgent.agentCard = newAgentCard;
    }

    // TODO: Encrypt token if present and changed
    if (body.authentication?.token) {
        body.authentication.encryptedToken = `encrypted-${body.authentication.token}`;
        delete body.authentication.token; // Remove raw token
        console.log("Token would be re-encrypted if changed.");
    }

    // TODO: Update fields in the database
    const updatedAgentData: AdkAgentStoredData = {
        id: agentId,
        name: body.name || "Existing Agent Name",
        a2aBaseUrl: body.a2aBaseUrl || "http://example.com/agent",
        authentication: body.authentication, // Potentially updated
        agentCard: { name: "Updated Agent Card", url: body.a2aBaseUrl || "http://example.com/agent" }, // Potentially updated
        createdAt: new Date().toISOString(), // Should be original creation date
        updatedAt: new Date().toISOString(),
    };
    console.log("ADK Agent updated (placeholder):", updatedAgentData);

    return NextResponse.json({ message: "ADK Agent updated (placeholder)", agent: updatedAgentData });
  } catch (error) {
    console.error(`Error updating ADK agent ${params.agentId}:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update ADK agent' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/adk-agents/{agentId}:
 *   delete:
 *     summary: Delete an ADK agent by ID
 *     tags: [ADK Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ADK agent to delete
 *     responses:
 *       200:
 *         description: ADK Agent deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: ADK Agent not found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = params;
    // TODO: Delete ADK agent with agentId from database
    console.log(`Deleting ADK agent with ID: ${agentId}`);

    // Placeholder: Simulate deletion
    if (agentId !== "existing-uuid") {
      return NextResponse.json({ error: "Not found (placeholder) to delete" }, { status: 404 });
    }

    console.log("ADK Agent deleted (placeholder)");
    return NextResponse.json({ message: "ADK Agent deleted (placeholder)" });
  } catch (error) {
    console.error(`Error deleting ADK agent ${params.agentId}:`, error);
    return NextResponse.json({ error: 'Failed to delete ADK agent' }, { status: 500 });
  }
}
