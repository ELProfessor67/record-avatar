import Fastify from 'fastify';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifySocketIo from 'fastify-socket.io';
import { INPUT_TEXT } from './constant/promptConstant.js';
import axios from 'axios';
import fastifyCors from 'fastify-cors';



// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);
fastify.register(fastifySocketIo, {
    cors: {
      origin: '*', // Adjust CORS as needed
    }
});

fastify.register(fastifyCors, { 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

const PORT = process.env.PORT || 5002;


// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Media Stream Server is running!' });
});

fastify.post('/get-access-token',async (request,reply) => {
    const API_KEY = process.env.HEYGEN_API_KEY;
    try {
        //Ask the server for a secure Access Token
        const response = await axios.post('https://api.heygen.com/v1/streaming.create_token', {}, {
            headers: {
                'x-api-key': API_KEY
            }
        });
        reply.send({token: response.data.data.token});
    } catch (error) {
        console.error('Error retrieving access token:', error);
        reply.status(500).send({ error: 'Failed to retrieve access token' });
    }
})

const sendTextToHeyGenServer = async (session_id,token,text) => {
    try {
        const response = await axios.post(
            `https://api.heygen.com/v1/streaming.task`,
            {
              session_id: session_id,
              text,
              task_type: 'repeat',
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
        );

        
    } catch (error) {
        console.log(error?.response?.data?.message || error?.message)
    }
}
// HeyGen
fastify.register(async (fastify) => {
    fastify.get('/heygen', { websocket: true }, (connection, req) => {
        const config = {
            user: {
                name: undefined,
                email: undefined
            },
            sessionToken: undefined,
            sessionData: undefined,
            input_text: INPUT_TEXT
        }
        
        // Handle incoming messages from Twilio
        connection.on('message', async (message) => {
            try {
                const data = JSON.parse(message); 
                switch (data.event) {
                    case 'start':
                        
                        config.user.name = data?.start?.user?.name;
                        config.user.email = data?.start?.user?.email;
                        config.sessionData = data.start.sessionData;
                        config.sessionToken = data.start.sessionToken;
                        config.input_text = data.start.input_text || INPUT_TEXT;
                        sendTextToHeyGenServer(config.sessionData.session_id,config.sessionToken,config.input_text);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close and log transcript
        connection.on('close', async () => {
            console.log(`Client disconnected`);
        });
    });
});


fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});