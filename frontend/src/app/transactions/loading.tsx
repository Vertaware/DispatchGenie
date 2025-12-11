export default function Loading() {
  return (
    <div className="flex size-full min-h-screen items-center justify-center">
      <div className="flex items-center justify-center space-x-1 text-sm text-gray-700">
        <div className="size-16 animate-spin rounded-full border-8 border-gray-300 border-t-gray-700" />
      </div>
    </div>
  );
}
