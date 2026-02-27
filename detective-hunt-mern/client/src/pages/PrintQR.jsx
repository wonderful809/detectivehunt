import { useEffect, useRef } from 'react';

const CLUE_LABELS = {
    1: 'Bench in the Green Space',
    2: 'Classroom 323',
    3: 'Visvesvaraya Hall',
    4: 'Water Cooler / Canteen',
    5: 'Snack Distributor',
    6: 'Vehicle AP39FK7467',
    7: 'Kalam Notice Board',
    8: 'Grievance Drop Box',
    9: 'Main Stage / Auditorium',
    10: 'Event Organizer (FINISH!)',
};

function buildQrData() {
    const data = [];
    for (let i = 1; i <= 10; i++) {
        data.push(
            { clue: i, value: `HUNT-CLUE-${i}-CORRECT`, type: 'correct' },
            { clue: i, value: `HUNT-CLUE-${i}-FAKE-A`, type: 'fake' },
            { clue: i, value: `HUNT-CLUE-${i}-FAKE-B`, type: 'fake' },
            { clue: i, value: `HUNT-CLUE-${i}-FAKE-C`, type: 'fake' }
        );
    }
    return data;
}

export default function PrintQR() {
    const containerRef = useRef(null);
    const generated = useRef(false);

    useEffect(() => {
        if (generated.current) return;
        generated.current = true;

        import('qrcode').then(QRCode => {
            const QR_DATA = buildQrData();
            const container = containerRef.current;
            if (!container) return;

            for (let clueNum = 1; clueNum <= 10; clueNum++) {
                const section = document.createElement('div');
                section.className = 'clue-section';

                const header = document.createElement('div');
                header.className = 'clue-header';
                header.innerHTML = `📍 Clue ${clueNum} — ${CLUE_LABELS[clueNum]} <span class="type-tag">4 QR codes</span>`;
                section.appendChild(header);

                const grid = document.createElement('div');
                grid.className = 'qr-grid';

                const clueQRs = QR_DATA.filter(q => q.clue === clueNum);
                clueQRs.forEach(async (qr) => {
                    const card = document.createElement('div');
                    card.className = `qr-card ${qr.type}`;

                    const badge = document.createElement('div');
                    badge.className = 'badge';
                    badge.textContent = qr.type === 'correct' ? '✅ CORRECT' : '❌ FAKE';
                    card.appendChild(badge);

                    const canvas = document.createElement('canvas');
                    card.appendChild(canvas);

                    try {
                        await QRCode.toCanvas(canvas, qr.value, {
                            width: 160, margin: 2,
                            color: { dark: '#000000', light: '#ffffff' },
                        });
                    } catch { }

                    const label = document.createElement('div');
                    label.className = 'qr-label';
                    label.textContent = qr.value;
                    card.appendChild(label);

                    grid.appendChild(card);
                });

                section.appendChild(grid);
                container.appendChild(section);
            }
        });
    }, []);

    return (
        <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: 20, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            <style>{`
        .clue-section { margin-bottom: 40px; border: 2px solid #333; border-radius: 12px; overflow: hidden; background: #1a1a1a; }
        .clue-header { background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; padding: 12px 20px; font-size: 1.2rem; font-weight: 700; }
        .clue-header .type-tag { float: right; font-size: 0.8rem; background: rgba(0,0,0,0.2); padding: 2px 10px; border-radius: 20px; }
        .qr-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 20px; }
        .qr-card { background: #fff; border-radius: 10px; padding: 16px; text-align: center; position: relative; }
        .qr-card.correct { border: 3px solid #22c55e; }
        .qr-card.fake { border: 3px solid #ef4444; }
        .qr-card .badge { position: absolute; top: 8px; right: 8px; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; }
        .qr-card.correct .badge { background: #22c55e; color: #fff; }
        .qr-card.fake .badge { background: #ef4444; color: #fff; }
        .qr-card canvas { display: block; margin: 8px auto; }
        .qr-card .qr-label { font-family: 'Courier New', monospace; font-size: 0.7rem; color: #333; word-break: break-all; margin-top: 8px; font-weight: 700; }
        @media print {
          body { background: #fff; color: #000; padding: 0; }
          .print-controls { display: none !important; }
          .clue-section { border: 2px solid #000; page-break-inside: avoid; margin-bottom: 20px; background: #fff; }
          .clue-header { background: #eee !important; color: #000 !important; }
        }
      `}</style>

            <h1 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: 10, color: '#f59e0b' }}>🕵️ ETRONS 2K26 — QR Codes</h1>
            <p style={{ textAlign: 'center', color: '#888', marginBottom: 30, fontSize: '0.9rem' }}>
                40 QR Codes total: 10 Correct (green border) + 30 Fake (red border). Print this page to get all codes.
            </p>

            <div className="print-controls" style={{ textAlign: 'center', marginBottom: 30 }}>
                <button onClick={() => window.print()}
                    style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '12px 32px', fontSize: '1.1rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer', margin: '0 8px' }}>
                    🖨️ Print All QR Codes
                </button>
            </div>

            <div ref={containerRef}></div>
        </div>
    );
}
