import MapApp from "@/components/MapApp";

type SearchParams = Record<string, string | string[] | undefined>;

function getSearchParam(searchParams: SearchParams | undefined, key: string): string | undefined {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default function Page({ searchParams }: { searchParams?: SearchParams }) {
  const embed = getSearchParam(searchParams, "embed") === "true";

  return (
    <main className={embed ? "h-screen overflow-hidden" : "min-h-screen"}>
      <MapApp embed={embed} />
    </main>
  );
}
