import { NextRequest, NextResponse } from 'next/server';
import { AdkAgentStoredData, AgentCard } from '@/types/adk-agent'; // AdkAgentRegistrationPayload might not be needed here directly
import { getAdkAgentById, updateAdkAgent, deleteAdkAgent } from '@/lib/adk-agent-db-mock';
// TODO: Import a2aClientService for actual Agent Card fetching in a later step for PUT
// import { a2aClientService } from '@/lib/a2a-client';

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
    const agent = await getAdkAgentById(agentId);

    if (!agent) {
      return NextResponse.json({ error: "ADK Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ agent }, { status: 200 });
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
    // Type assertion for the body, expect Partial updates relevant to AdkAgentStoredData fields
    // but not allowing 'id', 'createdAt', 'updatedAt' to be set directly via payload.
    const payload: Partial<Omit<AdkAgentStoredData, 'id' | 'createdAt' | 'updatedAt' | 'authentication'> & { authentication?: { type: 'apikey' | 'bearer'; token?: string; encryptedToken?: string } }> = await req.json();

    // TODO: If payload.a2aBaseUrl is different from stored, re-fetch and re-validate Agent Card
    // This would involve fetching the current agent data first.
    // const currentAgent = await getAdkAgentById(agentId);
    // if (!currentAgent) return NextResponse.json({ error: "ADK Agent not found for update" }, { status: 404 });
    // if (payload.a2aBaseUrl && payload.a2aBaseUrl !== currentAgent.a2aBaseUrl) {
    //   try {
    //     const newAgentCard = await a2aClientService.fetchAgentCard(payload.a2aBaseUrl);
    //     payload.agentCard = newAgentCard; // Update the agentCard in the payload
    //     console.log("Agent card re-fetched due to a2aBaseUrl change.");
    //   } catch (cardError: any) {
    //     return NextResponse.json({ error: `Failed to fetch new Agent Card: ${cardError.message}` }, { status: 400 });
    //   }
    // }
    if (payload.agentCard) { // If card is directly provided in payload (e.g. for testing mock)
        console.log("Using agentCard from payload for update. In a real scenario, this should be fetched if a2aBaseUrl changes.");
    }

    // Simulate re-encryption if a new raw token is provided
    // In a real implementation, you'd check if payload.authentication.token exists
    // and then encrypt it, assigning to payload.authentication.encryptedToken.
    // The updateAdkAgent function in mock DB doesn't handle nested auth object merge well by default for `token` vs `encryptedToken`.
    // So, we prepare the `authentication` part of the payload carefully.
    let authUpdatePayload: any = undefined;
    if (payload.authentication) {
        authUpdatePayload = { type: payload.authentication.type };
        if (payload.authentication.token) {
            // TODO: Implement actual token re-encryption
            authUpdatePayload.encryptedToken = `encrypted-${payload.authentication.token}`;
            console.log("Simulating token re-encryption for update.");
            // The raw 'token' field should not be part of the final payload for updateAdkAgent
        } else if (payload.authentication.encryptedToken) {
            // If encrypted token is passed directly (e.g. from a system process, not user)
            authUpdatePayload.encryptedToken = payload.authentication.encryptedToken;
        }
    }

    const updateDataForDb: Partial<Omit<AdkAgentStoredData, 'id' | 'createdAt' | 'updatedAt'>> = { ...payload };
    if (authUpdatePayload) {
        updateDataForDb.authentication = authUpdatePayload;
    } else if (payload.hasOwnProperty('authentication') && payload.authentication === null) {
        // Explicitly setting auth to null/undefined if desired
        updateDataForDb.authentication = undefined;
    }


    const updatedAgent = await updateAdkAgent(agentId, updateDataForDb);

    if (!updatedAgent) {
      return NextResponse.json({ error: "ADK Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "ADK Agent updated successfully", agent: updatedAgent }, { status: 200 });
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
    const success = await deleteAdkAgent(agentId);

    if (!success) {
      return NextResponse.json({ error: "ADK Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "ADK Agent deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting ADK agent ${params.agentId}:`, error);
    return NextResponse.json({ error: 'Failed to delete ADK agent' }, { status: 500 });
  }
}
