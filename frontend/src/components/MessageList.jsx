import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import WidgetFrame from "./WidgetFrame";
import WidgetLoading from "./WidgetLoading";
import Widget3DSkeleton from "./Widget3DSkeleton";
import FeedbackButtons from "./FeedbackButtons";
import LearningFeedbackButtons from "./LearningFeedbackButtons";
import FactCheckBadge from "./FactCheckBadge";
import ImageWidget from "./ImageWidget";
import LearningWorkspace from "./LearningWorkspace";

export default function MessageList({ messages, currentStreamedMessage, isLoadingWidget, factCheck = null, images = [], userId = null, onWidgetInteraction, learningContent = null, isLearningContentLoading = false, onLearningInteraction = null, is3DLoading = false, learningWorkspaceInitialTab = 'text' }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStreamedMessage, isLoadingWidget, is3DLoading]);

  const allMessages = [...messages];
  if (currentStreamedMessage) {
    allMessages.push({ ...currentStreamedMessage, id: "streaming-now" });
  }

  if (allMessages.length === 0) return null;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-4">
        {allMessages.map((msg, idx) => (
          <div key={msg.id || idx} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            
            {/* User Message */}
            {msg.role === "user" && (
              <div className="relative bg-primary/10 text-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] border border-primary/20 shadow-sm">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
              </div>
            )}

            {/* Assistant Widgets */}
            {msg.role === "assistant" && msg.widgets?.map(widget => (
              <div key={widget.id} className="my-2 w-full max-w-4xl">
                <WidgetFrame widget={widget} onInteraction={onWidgetInteraction} />
              </div>
            ))}

            {/* Widget Loading Card - shown while the model is generating */}
            {msg.role === "assistant" && msg.loadingWidget && (
              <WidgetLoading />
            )}

            {/* Assistant Images */}
            {msg.role === "assistant" && msg.images?.length > 0 && (
              <div className="my-2 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
                {msg.images.map((image, imgIdx) => (
                  <ImageWidget key={image.id || imgIdx} image={image} />
                ))}
              </div>
            )}

            {/* Assistant Text */}
            {msg.role === "assistant" && msg.text && (
              <div className="group flex w-full max-w-4xl gap-3 sm:gap-4">
                <div className="relative w-8 h-8 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-primary shadow-sm mt-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <MessageBubble content={msg.text} showTTS={msg.id !== "streaming-now"} />

                  {/* Fact Check Badge */}
                  {msg.factCheck && (
                    <FactCheckBadge factCheck={msg.factCheck} />
                  )}

                  {/* Learning Feedback Buttons */}
                  {msg.id !== "streaming-now" && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <FeedbackButtons
                          messageId={msg.id}
                          metadata={{ topic: msg.topic, hasWidgets: msg.widgets?.length > 0 }}
                        />
                      </div>
                      <LearningFeedbackButtons
                        messageId={msg.id}
                        userId={userId}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        ))}

        {/* Global Images (from asset stream) */}
        {images.length > 0 && (
          <div className="mx-auto w-full max-w-4xl">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Generated Images</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((image, idx) => (
                <ImageWidget key={image.id || idx} image={image} />
              ))}
            </div>
          </div>
        )}

        {/* Global Fact Check (from asset stream) */}
        {factCheck && (
          <div className="mx-auto mt-4 w-full max-w-4xl">
            <FactCheckBadge factCheck={factCheck} />
          </div>
        )}

        {/* 3D Widget Loading Skeleton - shown while 3D is generating */}
        {is3DLoading && (
          <div className="mx-auto mt-4 w-full max-w-4xl">
            <Widget3DSkeleton />
          </div>
        )}

        {/* Learning Workspace - shown after response completes */}
        {(learningContent || isLearningContentLoading) && messages.length > 0 && !currentStreamedMessage && (
          <div className="mx-auto mt-6 w-full max-w-5xl">
            <LearningWorkspace
              key={learningWorkspaceInitialTab}
              content={learningContent}
              isLoading={isLearningContentLoading}
              userId={userId}
              onInteraction={onLearningInteraction}
              initialTab={learningWorkspaceInitialTab}
            />
          </div>
        )}
      </div>
    </div>
  );
}
