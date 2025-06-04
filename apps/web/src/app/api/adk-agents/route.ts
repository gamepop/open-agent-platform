import { NextRequest, NextResponse } from 'next/server';
import { AdkAgentRegistrationPayload, AgentCard, AdkAgentStoredData } from '@/types/adk-agent';
import { v4 as uuidv4 } from 'uuid';

// TODO: Replace with actual database interactions

/**
 * @swagger
 * /api/adk-agents:
 *   get:
 *     summary: List all registered ADK agents
 *     tags: [ADK Agents]
 *     responses:
 *       200:
 *         description: A list of ADK agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdkAgentStoredData'
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Fetch all registered ADK agents from database
    const agents: AdkAgentStoredData[] = [];
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching ADK agents:', error);
    return NextResponse.json({ error: 'Failed to fetch ADK agents' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/adk-agents:
 *   post:
 *     summary: Register a new ADK agent
 *     tags: [ADK Agents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdkAgentRegistrationPayload'
 *     responses:
 *       201:
 *         description: ADK Agent registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 agent:
 *                   $ref: '#/components/schemas/AdkAgentStoredData'
 *       400:
 *         description: Invalid payload or failed to fetch/validate Agent Card
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const payload: AdkAgentRegistrationPayload = await req.json();

    // TODO: Validate payload
    if (!payload.name || !payload.a2aBaseUrl) {
      return NextResponse.json({ error: 'Missing required fields: name and a2aBaseUrl' }, { status: 400 });
    }

    // TODO: Construct Agent Card URL (e.g., ${a2aBaseUrl}/.well-known/agent.json)
    const agentCardUrl = `${payload.a2aBaseUrl.replace(/\/$/, "")}/.well-known/agent.json`;

    // Placeholder: Fetch Agent Card from the URL
    // In a real scenario, you would use a fetch library
    console.log(`Fetching Agent Card from: ${agentCardUrl}`);
    // const fetchedCardResponse = await fetch(agentCardUrl);
    // if (!fetchedCardResponse.ok) {
    //   return NextResponse.json({ error: `Failed to fetch Agent Card from ${agentCardUrl}. Status: ${fetchedCardResponse.status}` }, { status: 400 });
    // }
    // const agentCard: AgentCard = await fetchedCardResponse.json();
    const agentCard: AgentCard = { // Placeholder data
        name: "Placeholder Agent",
        url: payload.a2aBaseUrl,
        description: "This is a placeholder agent card.",
        capabilities: { streaming: true },
        skills: [{id: "skill1", name: "Placeholder Skill"}]
    };


    // TODO: Validate Agent Card structure
    if (!agentCard.name || !agentCard.url) {
        return NextResponse.json({ error: 'Invalid Agent Card structure: missing name or url' }, { status: 400 });
    }
    // More validation can be added here based on AgentCard interface


    // TODO: Encrypt token if present
    let encryptedToken: string | undefined = undefined;
    if (payload.authentication?.token) {
        // Placeholder for encryption
        encryptedToken = `encrypted-${payload.authentication.token}`;
        console.log("Token would be encrypted here.");
    }

    // Create AdkAgentStoredData object
    const newAgent: AdkAgentStoredData = {
      id: uuidv4(),
      name: payload.name,
      a2aBaseUrl: payload.a2aBaseUrl,
      authentication: payload.authentication ? { type: payload.authentication.type, encryptedToken } : undefined,
      agentCard: agentCard, // Store the fetched (or placeholder) agent card
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // TODO: Save to database
    console.log("ADK Agent to be saved (placeholder):", newAgent);

    return NextResponse.json({ message: "ADK Agent registered (placeholder)", agent: newAgent }, { status: 201 });
  } catch (error) {
    console.error('Error registering ADK agent:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to register ADK agent' }, { status: 500 });
  }
}
