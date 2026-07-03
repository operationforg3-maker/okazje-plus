import Image from 'next/image';

export default function UXPreviewV1() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">UI Preview - Version 1</h1>
      <Image src="/preview/ux_version_1.png" alt="UI Version 1" width={1200} height={800} />
    </div>
  );
}
