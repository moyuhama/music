import {useRetainedCover} from "../interactions/useRetainedCover";
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
  const retained = useRetainedCover(playerRole ? src : undefined);
  const imageSrc = playerRole ? retained : src;
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <div
      className={`cover cover-${index % 4} ${large ? "cover-large" : ""}`}
      aria-hidden="true"
      data-player-cover={playerRole}
    >
      {imageSrc && failedSrc !== imageSrc ? (
        <img
          src={imageSrc}
          referrerPolicy="no-referrer"
          alt=""
          loading={playerRole ? "eager" : "lazy"}
          onError={() => setFailedSrc(imageSrc)}
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
