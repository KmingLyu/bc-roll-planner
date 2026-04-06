export function CatChip({
  catId,
  name,
  getCatImageUrl,
}: {
  catId: number;
  name: string;
  getCatImageUrl: (catId: number) => string | undefined;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted/28 px-2.5 py-1.5">
      <img
        src={getCatImageUrl(catId)}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-md bg-background object-cover"
        loading="lazy"
      />
      <span className="min-w-0 break-keep text-sm font-medium leading-5 text-foreground">
        {name}
      </span>
    </div>
  );
}
