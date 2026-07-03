import Image from 'next/image';

export default function UXPreviewV5() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">UI Preview - Version 5</h1>
      <Image src="/preview/ux_version_5.png" alt="UI Version 5" width={1200} height={800} />
    </div>
  );
}
