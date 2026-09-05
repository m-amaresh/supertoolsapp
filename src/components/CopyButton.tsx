"use client";

import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck";
import { faCopy } from "@fortawesome/free-solid-svg-icons/faCopy";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/hooks/useClipboard";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const { copied, copy } = useClipboard();

  return (
    <Button
      type="button"
      onClick={() => copy(text)}
      variant={copied ? "success" : "secondary"}
      className={className}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <>
          <FontAwesomeIcon
            icon={faCheck}
            className="h-3 w-3"
            aria-hidden="true"
          />
          Copied
        </>
      ) : (
        <>
          <FontAwesomeIcon
            icon={faCopy}
            className="h-3 w-3"
            aria-hidden="true"
          />
          Copy
        </>
      )}
    </Button>
  );
}
