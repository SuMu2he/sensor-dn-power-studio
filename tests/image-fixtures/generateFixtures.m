function generateFixtures()
% Generate artificial codec samples, independent of any camera or experiment.
folder = fileparts(mfilename('fullpath'));
[x,y] = meshgrid(0:46,0:36);
image = uint16(mod(131*x+1009*y,65536));
files = {}; inputData = {};
for depth = [8 16]
    if depth==8, data=uint8(mod(image,256)); else, data=image; end
    name=sprintf('matlab_%dbit.png',depth);
    imwrite(data,fullfile(folder,name));
    files{end+1}=name; inputData{end+1}=data; %#ok<AGROW>
    for compression = {'none','packbits','lzw','deflate'}
        name=sprintf('matlab_%dbit_%s.tif',depth,compression{1});
        imwrite(data,fullfile(folder,name),'Compression',compression{1});
        files{end+1}=name; inputData{end+1}=data; %#ok<AGROW>
    end
end
data32=uint32(4100000000+131*x+1009*y);
data32(1,1)=0; data32(1,2)=intmax('uint32');
for compression = [Tiff.Compression.None,Tiff.Compression.LZW,Tiff.Compression.AdobeDeflate,Tiff.Compression.PackBits]
    name=sprintf('matlab_32bit_%d.tif',compression);
    t=Tiff(fullfile(folder,name),'w');
    tags=struct('ImageLength',37,'ImageWidth',47,'Photometric',Tiff.Photometric.MinIsBlack, ...
        'BitsPerSample',32,'SamplesPerPixel',1,'RowsPerStrip',16,'PlanarConfiguration',Tiff.PlanarConfiguration.Chunky, ...
        'Compression',compression,'SampleFormat',Tiff.SampleFormat.UInt);
    t.setTag(tags); t.write(data32); t.close();
    files{end+1}=name; inputData{end+1}=data32; %#ok<AGROW>
end
map=repmat((0:255)'/255,1,3); indexed=uint8(mod(image,256));
for extension={'.bmp','.tif','.png'}
    name=['indexed',extension{1}];
    imwrite(indexed,map,fullfile(folder,name));
    files{end+1}=name; inputData{end+1}=indexed; %#ok<AGROW>
end
imwrite(uint8(mod(image,256)),fullfile(folder,'matlab_gray.jpg'),'Quality',98);
manifest={};
for n=1:numel(files)
    manifest{end+1}=struct('Name',files{n},'Width',47,'Height',37, ...
        'Pixels',reshape(double(inputData{n})',1,[])); %#ok<AGROW>
end
fid=fopen(fullfile(folder,'manifest.json'),'w');
cleanup=onCleanup(@()fclose(fid)); %#ok<NASGU>
fprintf(fid,'%s',jsonencode(manifest));
end
