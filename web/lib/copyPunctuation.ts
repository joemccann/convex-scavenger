const EM_DASH = /(?:\u2014|&mdash;|&#0*8212;|&#x0*2014;)/gi;

/** Last-mile copy policy. Keep source files, minus signs and URL destinations intact. */
export function withoutEmDashes(text: string): string {
  return text.split(/(https?:\/\/[^\s<>()]+)/g).map((part, index) => {
    if (index % 2) return part.replace(EM_DASH, "%E2%80%94");
    return part.replace(EM_DASH, "\u2014")
      .replace(/^(\s*)\u2014[ \t]+/gm, "$1- ")
      .replace(/(\d(?:%|bps)?)[ \t]*\u2014[ \t]*(?=[$€£¥]?[+\-−]?\d)/gi, "$1 to ")
      .replace(/[ \t]*\u2014[ \t]*/g, ", ")
      .replace(/([,.;:!?])[ \t]*,[ \t]*/g, "$1 ")
      .replace(/,[ \t]*(?=[,.;:!?])/g, "");
  }).join("");
}
