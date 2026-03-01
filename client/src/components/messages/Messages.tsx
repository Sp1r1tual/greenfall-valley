import styles from "./Messages.module.css";

interface IMessagesProps {
  text: string;
  type: "normal" | "error" | "success";
}

export const Messages = ({ text, type }: IMessagesProps) => {
  const cls =
    type === "error"
      ? styles.infoError
      : type === "success"
        ? styles.infoSuccess
        : "";

  return <div className={`${styles.infoBar} ${cls}`}>{text}</div>;
};
