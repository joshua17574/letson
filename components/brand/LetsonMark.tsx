import Image from "next/image";

import { cn } from "@/lib/utils";

type LetsonMarkProps = {
  className?: string;
};

export function LetsonMark({ className }: LetsonMarkProps) {
  return (
    <Image
      src="/isay-logo.png"
      alt=""
      width={299}
      height={286}
      sizes="64px"
      aria-hidden="true"
      className={cn("block shrink-0 object-contain", className)}
      draggable={false}
      loading="eager"
    />
  );
}
