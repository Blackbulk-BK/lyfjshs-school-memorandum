// Shows what is inside the uploaded file.
// PDF / images / text -> shown directly. Word / Excel / PowerPoint -> Microsoft viewer.
// Anything else -> download link only.
export default function FilePreview({ url, name, type }: { url: string; name: string; type: string | null }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const isPdf = type === 'application/pdf' || ext === 'pdf';
  const isImage = (type ?? '').startsWith('image/');
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

  if (isPdf) return <iframe className="preview" src={url} title={name} />;
  if (isImage) return <img src={url} alt={name} style={{ maxWidth: '100%' }} />;
  if (isOffice) {
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return <iframe className="preview" src={viewer} title={name} />;
  }
  return <p>No preview available for this file type. Please download it to view.</p>;
}
