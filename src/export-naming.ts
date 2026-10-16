import {exportSuffixes,validatePrefix} from './export-data';
type DirectoryReader=Pick<FileSystemDirectoryHandle,'getFileHandle'>;
export async function nextGroupStem(directory:DirectoryReader|null,prefix:string,extension:string,fallback=1){
  const clean=validatePrefix(prefix),suffixes=exportSuffixes(extension);
  if(!directory)return `${clean}_${String(Math.max(1,fallback)).padStart(3,'0')}`;
  for(let number=1;number<1000000;number++){
    const stem=`${clean}_${String(number).padStart(3,'0')}`;let occupied=false;
    for(const suffix of suffixes){try{await directory.getFileHandle(stem+suffix);occupied=true;break;}catch(e){if(!(e instanceof DOMException&&e.name==='NotFoundError'))throw e;}}
    if(!occupied)return stem;
  }
  throw Error('No unused export group number was found. Choose a different filename prefix.');
}
