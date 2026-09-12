const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n>>>0);return b},u16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b},zero=n=>Buffer.alloc(n);
const box=(name,...parts)=>{const payload=Buffer.concat(parts);return Buffer.concat([u32(payload.length+8),Buffer.from(name),payload])};
const full=(name,flags,...parts)=>box(name,u32(flags),...parts);
const matrix=Buffer.concat([u32(65536),u32(0),u32(0),u32(0),u32(65536),u32(0),u32(0),u32(0),u32(0x40000000)]);
export function mux(encoded){
 const samples=encoded.chunks.map(c=>Buffer.from(c.bytes,'base64')),count=samples.length,duration=count*3000;
 const ftyp=box('ftyp',Buffer.from('isom'),u32(512),Buffer.from('isomiso2avc1mp41'));
 const mdat=box('mdat',...samples);
 const mvhd=full('mvhd',0,u32(0),u32(0),u32(90000),u32(duration),u32(65536),u16(256),zero(10),matrix,zero(24),u32(2));
 const tkhd=full('tkhd',7,u32(0),u32(0),u32(1),u32(0),u32(duration),zero(8),u16(0),u16(0),u16(0),u16(0),matrix,u32(960*65536),u32(540*65536));
 const mdhd=full('mdhd',0,u32(0),u32(0),u32(90000),u32(duration),u16(0x55c4),u16(0));
 const hdlr=full('hdlr',0,u32(0),Buffer.from('vide'),zero(12),Buffer.from('Motion review\0'));
 const avc1=box('avc1',zero(6),u16(1),zero(16),u16(960),u16(540),u32(0x00480000),u32(0x00480000),u32(0),u16(1),zero(32),u16(24),u16(0xffff),box('avcC',Buffer.from(encoded.config,'base64')));
 const stsd=full('stsd',0,u32(1),avc1),stts=full('stts',0,u32(1),u32(count),u32(3000)),stsc=full('stsc',0,u32(1),u32(1),u32(count),u32(1)),stsz=full('stsz',0,u32(0),u32(count),...samples.map(b=>u32(b.length))),stco=full('stco',0,u32(1),u32(ftyp.length+8));
 const keys=encoded.chunks.map((c,i)=>c.key?i+1:null).filter(Boolean),stss=full('stss',0,u32(keys.length),...keys.map(u32));
 const stbl=box('stbl',stsd,stts,stsc,stsz,stco,stss),dinf=box('dinf',full('dref',0,u32(1),full('url ',1)));
 const minf=box('minf',full('vmhd',1,zero(8)),dinf,stbl),moov=box('moov',mvhd,box('trak',tkhd,box('mdia',mdhd,hdlr,minf)));
 return Buffer.concat([ftyp,mdat,moov]);
}
