import type { LucideIcon } from "lucide-react";

type SectionHeadingProps = {
  prefix: "#" | "$";
  title: string;
  icon: LucideIcon;
};

export function SectionHeading({ prefix, title, icon: Icon }: SectionHeadingProps) {
  return (
    <div className="section-heading reveal">
      <Icon aria-hidden="true" size={23} />
      <h2>
        <span>{prefix}</span> {title}
      </h2>
    </div>
  );
}

