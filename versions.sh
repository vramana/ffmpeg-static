# Pinned source versions and checksums shared by all platform builds.
# Bump a version together with its checksum (or commit, for git sources).

FFMPEG_VERSION=9.0.2
FFMPEG_URL="https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz"
FFMPEG_SHA256=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e

# x264 has no tagged releases; pin a commit from the "stable" branch.
# Fetched with git: code.videolan.org's on-the-fly archives are not reliable in CI.
X264_GIT=https://code.videolan.org/videolan/x264.git
X264_COMMIT=b35605ace3ddf7c1a5d67a2eb553f034aef41d55

X265_VERSION=4.2
X265_URL="https://bitbucket.org/multicoreware/x265_git/downloads/x265_${X265_VERSION}.tar.gz"
X265_SHA256=40b1ea0453e0309f0eba934e0ddf533f8f6295966679e8894e8f1c1c8d5e1210

# libvpx is fetched with git at this commit (tag v$LIBVPX_VERSION).
LIBVPX_VERSION=1.17.0
LIBVPX_GIT=https://github.com/webmproject/libvpx.git
LIBVPX_COMMIT=6df3ec34557879fff673706f4a1d9fbd0f3a6f0e

LAME_VERSION=3.100
LAME_URL="https://downloads.sourceforge.net/project/lame/lame/${LAME_VERSION}/lame-${LAME_VERSION}.tar.gz"
LAME_SHA256=ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e

OPUS_VERSION=1.6.1
OPUS_URL="https://downloads.xiph.org/releases/opus/opus-${OPUS_VERSION}.tar.gz"
OPUS_SHA256=6ffcb593207be92584df15b32466ed64bbec99109f007c82205f0194572411a1

DAV1D_VERSION=1.5.4
# Official release tarball (a static file, unlike GitLab's generated archives).
DAV1D_URL="https://downloads.videolan.org/pub/videolan/dav1d/${DAV1D_VERSION}/dav1d-${DAV1D_VERSION}.tar.xz"
DAV1D_SHA256=686616b7c69eb88d44459391ab25cac13b6647a3b288835c5784e71c1514a5c5
