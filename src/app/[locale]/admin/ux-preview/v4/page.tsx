import Image from 'next/image';

export default function UXPreviewV4() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">UI Preview - Version 4</h1>
      <Image src="/preview/ux_version_4.png" alt="UI Version 4" width={1200} height={800} />
    </div>
  );
}
