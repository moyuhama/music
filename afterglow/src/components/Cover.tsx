import { useState } from "react";
import { Disc3 } from "lucide-react";
export default function Cover({
  index = 0,
  src,
  large = false,
  playerRole,
}: {
  index?: number;
  src?: string;
  large?: boolean;
  playerRole?: "mini" | "full";
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <div
      className={`cover cover-${index % 4} ${large ? "cover-large" : ""}`}
      aria-hidden="true"
      data-player-cover={playerRole}
    >
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt=""
          loading={playerRole ? "eager" : "lazy"}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <>
          <span className="cover-shape one" />
          <span className="cover-shape two" />
          <Disc3 className="cover-disc" strokeWidth={0.7} />
        </>
      )}
    </div>
  );
}
