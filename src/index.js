#!/usr/bin/env node
// makeugc-mcp — MCP server for MakeUGC.ai automation
// Usage: node src/index.js
// Register: claude mcp add makeugc node /path/to/makeugc-mcp/src/index.js

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { listActors, createVideo, createImage, animateSeedance, listVideos, getVideoUrl } = require('./makeugc');
const { cleanup } = require('./browser');

const server = new Server(
  { name: 'makeugc-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'makeugc_list_actors',
      description: 'Browse available AI actors on MakeUGC. Filter by gender (male/female), style (realistic/styled/natural/elegant), or age range.',
      inputSchema: {
        type: 'object',
        properties: {
          gender: { type: 'string', enum: ['male', 'female'], description: 'Filter by gender' },
          style: { type: 'string', enum: ['realistic', 'styled', 'natural', 'elegant'], description: 'Filter by style' },
          age: { type: 'string', description: 'Filter by age range e.g. 18-30' }
        }
      }
    },
    {
      name: 'makeugc_create_video',
      description: 'Create a UGC video using the Talking Actors mode. Provide a script and actor name.',
      inputSchema: {
        type: 'object',
        required: ['script', 'actorName'],
        properties: {
          script: {
            type: 'string',
            description: 'The video script. Use [laughs], [sighs], [excited] for emotion tags. Keep under 150 words.'
          },
          actorName: {
            type: 'string',
            description: 'Exact actor name from makeugc_list_actors (e.g. "Julian", "Camille")'
          },
          voice: {
            type: 'string',
            enum: ['nova', 'omnihuman'],
            default: 'nova',
            description: 'Voice mode: nova = Nova 2.0 (best quality), omnihuman = Omnihuman mode'
          }
        }
      }
    },
    {
      name: 'makeugc_create_image',
      description: 'Generate an AI image using MakeUGC Image Generator. Text-to-image or image-to-image (provide imageFile path for reference).',
      inputSchema: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            description: 'Image description prompt. Be specific about style, lighting, composition.'
          },
          imageFile: {
            type: 'string',
            description: 'Optional: absolute path to a local reference image (PNG/JPG) for image-to-image mode'
          },
          model: {
            type: 'string',
            default: 'Grok',
            description: 'AI model to use (default: Grok)'
          }
        }
      }
    },
    {
      name: 'makeugc_animate_seedance',
      description: 'Animate an image into a video using MakeUGC Seedance 2.0. Upload an image and describe the motion.',
      inputSchema: {
        type: 'object',
        required: ['prompt'],
        properties: {
          imageFile: {
            type: 'string',
            description: 'Absolute path to local image file (PNG/JPG) to animate'
          },
          imageUrl: {
            type: 'string',
            description: 'URL of image to animate (used if imageFile not provided)'
          },
          prompt: {
            type: 'string',
            description: 'Motion description. Describe camera movement, subject motion, and atmosphere. Use @Image1 to reference uploaded image.'
          },
          quality: {
            type: 'string',
            enum: ['fast', 'best'],
            default: 'best',
            description: 'Generation quality: fast = quicker output, best = Pro quality (default)'
          }
        }
      }
    },
    {
      name: 'makeugc_list_videos',
      description: 'List all videos in the MakeUGC workspace. Shows title, status (generating/ready), and links.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'makeugc_get_video',
      description: 'Get download URL or details for a specific video by its index in the list.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'number', description: 'Video index from makeugc_list_videos (0-based)', default: 0 }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'makeugc_list_actors':
        result = await listActors(args || {});
        return {
          content: [{
            type: 'text',
            text: result.length === 0
              ? 'No actors found with those filters. Try without filters first.'
              : `Found ${result.length} actors:\n${result.map(a => `• ${a.name}`).join('\n')}`
          }]
        };

      case 'makeugc_create_video':
        result = await createVideo(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };

      case 'makeugc_create_image':
        result = await createImage(args || {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };

      case 'makeugc_animate_seedance':
        result = await animateSeedance(args || {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };

      case 'makeugc_list_videos':
        result = await listVideos();
        return {
          content: [{
            type: 'text',
            text: result.count === 0
              ? 'No videos found in workspace.'
              : `${result.count} videos:\n${result.videos.map((v, i) =>
                  `${i}. ${v.title} — ${v.status}${v.link ? ` — ${v.link}` : ''}`
                ).join('\n')}`
          }]
        };

      case 'makeugc_get_video':
        result = await getVideoUrl((args || {}).index || 0);
        return {
          content: [{
            type: 'text',
            text: result ? JSON.stringify(result, null, 2) : 'Video not found at that index.'
          }]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
});

process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
