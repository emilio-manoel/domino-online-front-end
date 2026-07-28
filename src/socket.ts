import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket"],
});