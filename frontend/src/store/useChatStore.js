import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5001";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  socket: null,

  connectSocket: (token) => {
    if (get().socket) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("getOnlineUsers", (users) => {
      useAuthStore.getState().setOnlineUsers(users);
    });

    socket.on("forceDisconnect", () => {
      socket.disconnect();
      toast.error("New session started from another window");
      window.location.reload();
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      toast.error("Failed to connect to chat server");
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
      useAuthStore.getState().setOnlineUsers([]);
    }
  },

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, socket } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });

      if (socket) {
        socket.emit("newMessage", {
          message: res.data,
          receiverId: selectedUser._id,
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    const socket = get().socket;
    
    if (!selectedUser || !socket) return;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set((state) => ({
        messages: [...state.messages, newMessage],
      }));
    });
  },

  unsubscribeFromMessages: () => {
    const socket = get().socket;
    if (socket) {
      socket.off("newMessage");
    }
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));