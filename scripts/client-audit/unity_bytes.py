"""Bounded read-only UnityFS/LZ4 byte extraction, without running game code."""
import struct

def lz4_block(data, expected):
    out=bytearray();p=0
    if expected>256*1024*1024:raise ValueError('Oversized decompressed block')
    while p<len(data):
        token=data[p];p+=1;n=token>>4
        if n==15:
            while True:
                if p>=len(data):raise ValueError('Truncated literal length')
                x=data[p];p+=1;n+=x
                if x<255:break
        if p+n>len(data) or len(out)+n>expected:raise ValueError('Literal outside bounds')
        out.extend(data[p:p+n]);p+=n
        if p==len(data):break
        if p+2>len(data):raise ValueError('Truncated match offset')
        offset=int.from_bytes(data[p:p+2],'little');p+=2
        if not offset or offset>len(out):raise ValueError('Invalid match offset')
        n=(token&15)+4
        if token&15==15:
            while True:
                if p>=len(data):raise ValueError('Truncated match length')
                x=data[p];p+=1;n+=x
                if x<255:break
        if len(out)+n>expected:raise ValueError('Match outside output bounds')
        for _ in range(n):out.append(out[-offset])
    if len(out)!=expected:raise ValueError('Decompressed size mismatch')
    return bytes(out)

def decompress(data,expected,flags):
    mode=flags&63
    if mode==0:
        if len(data)!=expected:raise ValueError('Uncompressed size mismatch')
        return data
    if mode in (2,3):return lz4_block(data,expected)
    raise ValueError('Unsupported compression; no guessed decode: '+str(mode))

def unity_files(body):
    if body[:8]!=b'UnityFS\0':raise ValueError('UnityFS signature required')
    p=8;version=struct.unpack_from('>I',body,p)[0];p+=4;versions=[]
    for _ in range(2):
        e=body.index(0,p);versions.append(body[p:e].decode('ascii'));p=e+1
    size,compressed,uncompressed,flags=struct.unpack_from('>QIII',body,p);p+=20
    if size!=len(body) or version<7:raise ValueError('Unsupported version or body length')
    if flags&~(0x3f|0x40|0x80|0x200):raise ValueError('Unsupported UnityFS flags')
    p=(p+15)&~15
    info_at=len(body)-compressed if flags&0x80 else p
    info=decompress(body[info_at:info_at+compressed],uncompressed,flags)
    if not flags&0x80:p+=compressed
    q=16;count=struct.unpack_from('>I',info,q)[0];q+=4
    if count>100000:raise ValueError('Excessive block count')
    blocks=[]
    for _ in range(count):blocks.append(struct.unpack_from('>IIH',info,q));q+=10
    nodes_count=struct.unpack_from('>I',info,q)[0];q+=4;nodes=[]
    if nodes_count>100000:raise ValueError('Excessive node count')
    for _ in range(nodes_count):
        offset,length,node_flags=struct.unpack_from('>QQI',info,q);q+=20;e=info.index(0,q);name=info[q:e].decode('utf-8');q=e+1;nodes.append((name,offset,length,node_flags))
    if q!=len(info):raise ValueError('Unconsumed directory bytes')
    if flags&0x200:p=(p+15)&~15
    total=sum(b[0] for b in blocks)
    if total>512*1024*1024:raise ValueError('Oversized bundle')
    data=bytearray()
    for u,c,f in blocks:
        if p+c>len(body):raise ValueError('Compressed block outside source')
        data.extend(decompress(body[p:p+c],u,f));p+=c
    result={}
    for name,offset,length,node_flags in nodes:
        if offset+length>len(data) or name in result:raise ValueError('Invalid node bounds/identity')
        result[name]=bytes(data[offset:offset+length])
    return result,{'formatVersion':version,'unityVersions':versions,'flags':flags,'blocks':len(blocks),'serializedNodes':len(nodes),'decodedBytes':len(data)}

def textasset(raw):
    p=0;strings=[]
    for _ in range(2):
        if p+4>len(raw):raise ValueError('Truncated TextAsset length')
        length=struct.unpack_from('<I',raw,p)[0];p+=4
        if p+length>len(raw):raise ValueError('TextAsset content outside object')
        strings.append(raw[p:p+length]);p=(p+length+3)&~3
    if p!=len(raw):raise ValueError('Unexpected TextAsset suffix')
    return strings[0].decode('utf-8'),strings[1]
