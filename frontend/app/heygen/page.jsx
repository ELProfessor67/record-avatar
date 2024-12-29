'use client'
import React, { useState, useRef, useEffect, useCallback } from "react";
import * as LivekitClient from 'livekit-client'
import { Mic, MicOff, MoreVertical, PhoneOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const HeyGenStreaming = () => {

    const API_CONFIG = {
        serverUrl: "https://api.heygen.com",
    };
    const searchParams = useSearchParams();
    const input_text = searchParams.get('input_text');

    const [taskInput, setTaskInput] = useState("");
    const [status, setStatus] = useState([]);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [sessionToken, setSessionToken] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [connected, setConnected] = useState(false);

    const mediaElement = useRef(null);
    const roomRef = useRef(null);
    const mediaStream = useRef();
    const webSocket = useRef(null);
    const sessTokenRef = useRef(null);
    const sessionDataRef = useRef(null);
    const transcribeWebsocketRef = useRef(null);
    const streamRef = useRef(null);
    const mediaChunksRef = useRef([]);
    const mediaRecorder = useRef([]);
    const isAlreadyRef = useRef(null);
    const router = useRouter();



    const recordVideoStream = useCallback((stream) => {
        mediaRecorder.current = new MediaRecorder(stream);

        mediaRecorder.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                console.log(event.data)
                mediaChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.current.onstop = () => {
            // Create a Blob from the recorded chunks
            const blob = new Blob(mediaChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);

            // Trigger a direct download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'recording.webm';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Clean up
            URL.revokeObjectURL(url);
            endCall();
        };
    }, []);

    // Helper to update status
    const updateStatus = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setStatus((prev) => [...prev, `[${timestamp}] ${message}`]);
    };



    const toggleMute = useCallback(() => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                if (isMuted) {
                    audioTrack.enabled = true;
                    setIsMuted(false);
                } else {
                    audioTrack.enabled = false;
                    setIsMuted(true);
                }
            }
        }
    }, [isMuted]);

    const endCall = useCallback(() => {
        transcribeWebsocketRef.current?.close();
        closeSession();
        router.push('/');
    }, []);



    const onConnect = useCallback(() => {
        console.log('connected')
        const data = {
            event: 'start',
            start: {
                user: {
                    name: "Manan Rajpout",
                    email: "email@gmail.com",
                },
                sessionToken: sessTokenRef.current,
                sessionData: sessionDataRef.current,
                input_text: input_text
            }
        }
        transcribeWebsocketRef.current.send(JSON.stringify(data));

    }, [sessTokenRef, sessionDataRef,input_text]);


    const connectTranscibtionWebsocket = useCallback(async () => {
        const ws = new WebSocket(`${process.env.NEXT_PUBLIC_HEYGEN_SERVER_URL}/heygen`);
        transcribeWebsocketRef.current = ws;
        ws.onopen = onConnect;
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
        };

        ws.onclose = () => {
            endCall();
            console.log('close');
        }
    }, [sessTokenRef, sessionDataRef]);

    // Fetch session token
    const getSessionToken = async () => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_HEYGEN_SERVER_URL}/get-access-token`,
                {
                    method: "POST"
                }
            );
            const data = await response.json();
            setSessionToken(data.token);
            sessTokenRef.current = data.token;
            updateStatus("Session token obtained");
        } catch (error) {
            updateStatus("Failed to fetch session token");
        }
    };

    // Connect WebSocket
    const connectWebSocket = async (sessionId) => {
        const params = new URLSearchParams({
            session_id: sessionId,
            session_token: sessionToken,
            silence_response: false,
            opening_text: "Hello, how can I help you?",
            stt_language: "en",
        });

        const wsUrl = `wss://${new URL(API_CONFIG.serverUrl).hostname
            }/v1/ws/streaming.chat?${params}`;

        webSocket.current = new WebSocket(wsUrl);

        webSocket.current.onmessage = (event) => {
            const eventData = JSON.parse(event.data);
            console.log("WebSocket Event:", eventData);
        };

        webSocket.current.onclose = () => {
            updateStatus("WebSocket closed");
        };
    };

    // Create new session
    const createNewSession = async () => {
        if (!sessTokenRef.current) {
            await getSessionToken();
        }

        try {
            const response = await fetch(
                `${API_CONFIG.serverUrl}/v1/streaming.new`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${sessTokenRef.current}`,
                    },
                    body: JSON.stringify({
                        quality: "high",

                        avatar_name: "",
                        voice: { voice_id: "", rate: 1.4 },
                        version: "v2",
                        video_encoding: "H264",
                    }),
                }
            );


            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);

            }

            setSessionInfo(data.data);
            sessionDataRef.current = data.data;


            // Create LiveKit Room
            const room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: LivekitClient.VideoPresets.h720.resolution,
                },
            });

            roomRef.current = room;

            // Handle room events
            room.on(LivekitClient.RoomEvent.DataReceived, (message) => {
                const data = new TextDecoder().decode(message);
                const messageParse = JSON.parse(data)
                if(messageParse.type == "avatar_stop_talking"){
                    mediaRecorder.current?.stop();
                }
                if(messageParse.type == "avatar_start_talking"){
                    mediaRecorder.current?.start(250);
                }
                console.log("Room message:", messageParse);
            });

            // Handle media streams
            let mediaStream = new MediaStream();
            room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
                if (track.kind === "video" || track.kind === "audio") {
                    mediaStream.addTrack(track.mediaStreamTrack);
                    if (
                        mediaStream.getVideoTracks().length > 0 &&
                        mediaStream.getAudioTracks().length > 0
                    ) {
                        mediaElement.current.srcObject = mediaStream;
                        recordVideoStream(mediaStream);
                        setConnected(true)
                        updateStatus("Media stream ready");
                    }
                }
            });

            // Handle media stream removal
            room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
                const mediaTrack = track.mediaStreamTrack;
                if (mediaTrack) {
                    mediaStream.removeTrack(mediaTrack);
                }
            });

            // Handle room connection state changes
            room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
                updateStatus(`Room disconnected: ${reason}`);
            });

            room.on(LivekitClient.RoomEvent.Connected, (e) => {
                updateStatus('Room Connected');
                connectTranscibtionWebsocket();
            });

            console.log('data.data.url, data.data.access_token', data.data.url, data.data.access_token)
            await room.prepareConnection(data.data.url, data.data.access_token);

            updateStatus("Connection prepared");

            setIsSessionActive(true);
            await connectWebSocket(data.data.session_id);
            updateStatus("Session created successfully");
            startStreamingSession();
        } catch (error) {
            alert(error.message);
            updateStatus(`Failed to create session ${error.message}`);
        }
    };

    // Start streaming session
    const startStreamingSession = async () => {
        if (!sessionDataRef.current) return;

        try {
            await fetch(`${API_CONFIG.serverUrl}/v1/streaming.start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessTokenRef.current}`,
                },
                body: JSON.stringify({
                    session_id: sessionDataRef.current.session_id,
                }),
            });

            await roomRef.current.connect(sessionDataRef.current.url, sessionDataRef.current.access_token);
            updateStatus("Streaming started successfully");
        } catch (error) {
            updateStatus("Failed to start streaming");
        }
    };

    // Close session
    const closeSession = async () => {
        if (!sessionDataRef.current) return;

        try {
            await fetch(`${API_CONFIG.serverUrl}/v1/streaming.stop`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessTokenRef.current}`,
                },
                body: JSON.stringify({ session_id: sessionDataRef.current.session_id }),
            });

            webSocket.current?.close();
            roomRef.current?.disconnect();
            mediaElement.current.srcObject = null;

            setSessionInfo(null);
            setIsSessionActive(false);
            updateStatus("Session closed");
        } catch (error) {
            updateStatus("Failed to close session");
        }
    };


    useEffect(() => {
        if (!isAlreadyRef.current) {

            isAlreadyRef.current = true;
            createNewSession();
        }

        return () => {
            closeSession();
            transcribeWebsocketRef.current?.close();
        }
    }, []);

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
            {/* Header */}
            <header className="bg-white shadow-md p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-indigo-600">Talk Better</h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container  mx-auto w-[100vw] p-4 flex flex-col items-center justify-center">


                <video
                    hidden={!connected}
                    ref={mediaElement}
                    className="w-full border rounded-lg max-h-[30rem]"
                    autoPlay
                ></video>


                {
                    !connected &&
                    <h3 className="text-4xl">Conneting...</h3>
                }


            </main>

            {/* Control Bar */}
            <div className="bg-white shadow-lg p-4">
                <div className="container mx-auto flex justify-center items-center space-x-6">
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
                            } hover:opacity-80 transition-opacity`}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    <button
                        onClick={endCall}
                        className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                        <PhoneOff size={24} />
                    </button>
                    <button className="p-4 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
                        <MoreVertical size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeyGenStreaming;
