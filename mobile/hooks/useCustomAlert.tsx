import { useState, useCallback } from "react";
import { AlertType } from "../components/CustomAlert";

interface AlertAction {
  text: string;
  onPress?: () => void;
  style?: "default" | "primary" | "cancel";
}

interface AlertConfig {
  type?: AlertType;
  title: string;
  message: string;
  actions?: AlertAction[];
}

interface AlertState extends AlertConfig {
  visible: boolean;
}

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    actions: [],
  });

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertState({
      visible: true,
      type: config.type || "info",
      title: config.title,
      message: config.message,
      actions: config.actions || [{ text: "OK", style: "primary" }],
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    alertState,
    showAlert,
    hideAlert,
  };
}
