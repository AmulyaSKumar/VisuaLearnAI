import { useNavigate } from "react-router-dom";
import InputBar from "./InputBar";

export default function WelcomeScreen() {
  const navigate = useNavigate();

  const handleSend = (text) => {
    const newChatId = Math.random().toString(36).substring(7);
    navigate(`/chat/${newChatId}`, { state: { initialMessage: text } });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background relative z-10">
      
      {/* Hero */}
      <div className="mb-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center text-primary mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight text-center">
          What would you like to learn?
        </h1>
        <p className="text-muted-foreground text-center text-sm max-w-md mx-auto">
          Ask any question and I'll create interactive visualizations, diagrams, and explanations to help you understand.
        </p>
      </div>

      <div className="w-full max-w-2xl px-4 mt-6">
        <InputBar onSend={handleSend} />

        <div className="flex flex-wrap justify-center gap-2.5 mt-8">
          <ActionTag 
            icon="📊" 
            label="Visualize Compound Interest" 
            onClick={() => handleSend("Explain and visualize compound interest over 20 years")} 
          />
          <ActionTag 
            icon="🧬" 
            label="DNA Structure" 
            onClick={() => handleSend("Show me an interactive visualization of DNA double helix structure")} 
          />
          <ActionTag 
            icon="⚡" 
            label="Sorting Algorithms" 
            onClick={() => handleSend("Visualize how bubble sort vs quicksort algorithms work with a comparison")} 
          />
          <ActionTag 
            icon="🌍" 
            label="Solar System" 
            onClick={() => handleSend("Create an interactive visualization of our solar system with planet sizes and distances")} 
          />
          <ActionTag 
            icon="📈" 
            label="Supply & Demand" 
            onClick={() => handleSend("Visualize supply and demand curves with interactive price and quantity sliders")} 
          />
          <ActionTag 
            icon="🎵" 
            label="Sound Waves" 
            onClick={() => handleSend("Create an interactive visualization of sound waves showing frequency and amplitude")} 
          />
        </div>
      </div>
    </div>
  );
}

function ActionTag({ icon, label, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 text-[13px] text-foreground transition-all"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
