export function MasonryGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="columns-6 gap-2.5 *:mb-2.5 *:break-inside-avoid max-md:columns-4 max-sm:columns-2">
      {children}
    </div>
  );
}
