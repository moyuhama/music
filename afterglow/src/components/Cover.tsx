import { Disc3 } from "lucide-react";
export default function Cover({
  index = 0,
  src,
  large = false,
}: {
  index?: number;
  src?: string;
  large?: boolean;
}) {
  return (
    <div
      className={`cover cover-${index % 4} ${large ? "cover-large" : ""}`}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
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
