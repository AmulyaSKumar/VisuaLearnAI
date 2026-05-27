import MessageList from "./MessageList";

export default function MessageRenderer({
  mode = "chat",
  learningContent = null,
  isLearningContentLoading = false,
  ...props
}) {
  const isLearningMode = mode === "learning";
  const shouldShowLearningWorkspace = isLearningMode || Boolean(learningContent) || isLearningContentLoading;

  return (
    <MessageList
      {...props}
      learningContent={shouldShowLearningWorkspace ? learningContent : null}
      isLearningContentLoading={shouldShowLearningWorkspace ? isLearningContentLoading : false}
      allowLearningWorkspace={shouldShowLearningWorkspace}
    />
  );
}
