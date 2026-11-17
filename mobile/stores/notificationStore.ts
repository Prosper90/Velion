import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface NotificationState {
  unreadCount: number;
  lastViewedTimestamp: number;
  notifications: Array<{
    id: string;
    type: "shield" | "unshield" | "private_transfer" | "public_transfer" | "receive";
    txHash: string;
    amount: string;
    token: string;
    timestamp: number;
    read: boolean;
  }>;

  // Actions
  incrementUnread: () => void;
  clearUnread: () => void;
  addNotification: (notification: {
    type: "shield" | "unshield" | "private_transfer" | "public_transfer" | "receive";
    txHash: string;
    amount: string;
    token: string;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      unreadCount: 0,
      lastViewedTimestamp: Date.now(),
      notifications: [],

      incrementUnread: () => {
        set((state) => ({
          unreadCount: state.unreadCount + 1,
        }));
      },

      clearUnread: () => {
        set({
          unreadCount: 0,
          lastViewedTimestamp: Date.now(),
        });
      },

      addNotification: (notification) => {
        const id = `${notification.txHash}-${Date.now()}`;
        console.log("🔔 [NotificationStore] Adding notification:", {
          id,
          ...notification,
          currentUnreadCount: get().unreadCount,
        });

        set((state) => {
          const newState = {
            notifications: [
              {
                id,
                ...notification,
                timestamp: Date.now(),
                read: false,
              },
              ...state.notifications,
            ],
            unreadCount: state.unreadCount + 1,
          };

          console.log("🔔 [NotificationStore] New unread count:", newState.unreadCount);
          console.log("🔔 [NotificationStore] Total notifications:", newState.notifications.length);

          return newState;
        });
      },

      markAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (!notification || notification.read) {
            return state;
          }

          return {
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
          lastViewedTimestamp: Date.now(),
        }));
      },

      getUnreadCount: () => {
        return get().unreadCount;
      },
    }),
    {
      name: "notification-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
