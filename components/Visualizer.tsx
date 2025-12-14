import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  color: string; // Hex color string
  isMuted?: boolean;
  label?: string;
  width?: number;
  height?: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  analyser, 
  color, 
  isMuted = false,
  label,
  width = 300, 
  height = 100 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw Background / Grid lines (Optional aesthetic)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.5)'; // Slate-900 with opacity
      ctx.fillRect(0, 0, width, height);

      // Muted State
      if (isMuted) {
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = '#EF4444'; // Red-500
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.font = '12px Inter';
        ctx.fillStyle = '#EF4444';
        ctx.textAlign = 'center';
        ctx.fillText("MUTED", width/2, height/2 - 10);
        
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      if (!analyser) {
        // Idle line
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = color; // Using prop color
        ctx.lineWidth = 2;
        ctx.stroke();
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      // Waveform Data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // Normalize 0..255 to 0..2 approx
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, color, isMuted, width, height]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900/50 backdrop-blur-sm shadow-inner">
      <canvas ref={canvasRef} width={width} height={height} />
      {label && (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-950/80 px-2 py-0.5 rounded">
          {label}
        </span>
      )}
    </div>
  );
};

export default Visualizer;
