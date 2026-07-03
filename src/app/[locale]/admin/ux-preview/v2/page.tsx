import Image from 'next/image';

export default function UXPreviewV2() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">UI Preview - Version 2</h1>
      <Image src="/preview/ux_version_2.png" alt="UI Version 2" width={1200} height={800} />
    </div>
  );
}
