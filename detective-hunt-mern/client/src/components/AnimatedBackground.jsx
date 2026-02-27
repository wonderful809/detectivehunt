export default function AnimatedBackground() {
    return (
        <div className="bg-animation">
            <div className="bg-grid"></div>
            <div className="bg-orb bg-orb-1"></div>
            <div className="bg-orb bg-orb-2"></div>
            <div className="bg-orb bg-orb-3"></div>
            <div className="floating-icons">
                <span className="float-icon" style={{ '--i': 1 }}>🔍</span>
                <span className="float-icon" style={{ '--i': 2 }}>🕵️</span>
                <span className="float-icon" style={{ '--i': 3 }}>🧩</span>
                <span className="float-icon" style={{ '--i': 4 }}>🗝️</span>
                <span className="float-icon" style={{ '--i': 5 }}>📋</span>
                <span className="float-icon" style={{ '--i': 6 }}>🔦</span>
                <span className="float-icon" style={{ '--i': 7 }}>🎯</span>
                <span className="float-icon" style={{ '--i': 8 }}>💡</span>
            </div>
        </div>
    );
}
