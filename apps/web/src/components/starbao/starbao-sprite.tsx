import styles from "./starbao-sprite.module.css";

export const starbaoMoods = ["idle", "thinking", "cheer", "sleep", "drawing", "walk"] as const;

export type StarbaoMood = (typeof starbaoMoods)[number];

type StarbaoSpriteProps = {
  mood: StarbaoMood;
  className?: string;
  paused?: boolean;
};

export function StarbaoSprite({ mood, className, paused = false }: StarbaoSpriteProps) {
  const classNames = [
    styles.sprite,
    styles[`mood-${mood}`],
    paused ? styles.paused : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return <span className={classNames} data-starbao-mood={mood} aria-hidden="true" />;
}
