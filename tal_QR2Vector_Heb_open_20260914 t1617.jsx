// ============================================================================
//  QR2Vector
//  ------------------------------------------------------------
//  (c) 2026 Tal Nadav. All rights reserved.
//  Author: Tal Nadav
//  Release Date: 202609
//  Contact: tal74design@gmail.com
//
//  Unauthorized redistribution, resale, or removal of this
//  credit notice is prohibited without the author's permission.
//  ------------------------------------------------------------
//  Simple vector QR-code generator for Adobe Illustrator (Hebrew UI).
//  ExtendScript (ES3/ES5) — single-file, no external dependencies.
//
//  Embeds the full QR-code math engine originally authored by
//  Kazuhiko Arase (MIT License) — https://github.com/kazuhikoarase/qrcode-generator
//  This build includes the COMPLETE RS_BLOCK_TABLE (versions 1-40) and the
//  COMPLETE PATTERN_POSITION_TABLE (versions 1-40), untruncated, so that
//  long URLs/text do not trigger "glog(undefined)" style errors.
// ============================================================================

(function () {

    // ------------------------------------------------------------------
    // 1. QR CODE ENGINE  (Kazuhiko Arase, MIT License)
    // ------------------------------------------------------------------

    var QRCode = function (typeNumber, errorCorrectionLevel) {
        this.typeNumber = typeNumber;
        this.errorCorrectionLevel = QRErrorCorrectLevel[errorCorrectionLevel];
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    };

    QRCode.prototype = {

        addData: function (data) {
            var newData = new QR8bitByte(data);
            this.dataList.push(newData);
            this.dataCache = null;
        },

        isDark: function (row, col) {
            if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
                throw new Error(row + "," + col);
            }
            return this.modules[row][col];
        },

        getModuleCount: function () {
            return this.moduleCount;
        },

        make: function () {
            this.makeImpl(false, this.getBestMaskPattern());
        },

        makeImpl: function (test, maskPattern) {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);

            for (var row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (var col = 0; col < this.moduleCount; col++) {
                    this.modules[row][col] = null;
                }
            }

            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupPositionAdjustPattern();
            this.setupTimingPattern();
            this.setupTypeInfo(test, maskPattern);

            if (this.typeNumber >= 7) {
                this.setupTypeNumber(test);
            }

            if (this.dataCache == null) {
                this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
            }

            this.mapData(this.dataCache, maskPattern);
        },

        setupPositionProbePattern: function (row, col) {
            for (var r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (var c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c == 0 || c == 6))
                        || (0 <= c && c <= 6 && (r == 0 || r == 6))
                        || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },

        getBestMaskPattern: function () {
            var minLostPoint = 0;
            var pattern = 0;

            for (var i = 0; i < 8; i++) {
                this.makeImpl(true, i);
                var lostPoint = QRUtil.getLostPoint(this);
                if (i == 0 || minLostPoint > lostPoint) {
                    minLostPoint = lostPoint;
                    pattern = i;
                }
            }
            return pattern;
        },

        setupTimingPattern: function () {
            for (var r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] != null) continue;
                this.modules[r][6] = (r % 2 == 0);
            }
            for (var c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] != null) continue;
                this.modules[6][c] = (c % 2 == 0);
            }
        },

        setupPositionAdjustPattern: function () {
            var pos = QRUtil.getPatternPosition(this.typeNumber);
            for (var i = 0; i < pos.length; i++) {
                for (var j = 0; j < pos.length; j++) {
                    var row = pos[i];
                    var col = pos[j];
                    if (this.modules[row][col] != null) continue;
                    for (var r = -2; r <= 2; r++) {
                        for (var c = -2; c <= 2; c++) {
                            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                                this.modules[row + r][col + c] = true;
                            } else {
                                this.modules[row + r][col + c] = false;
                            }
                        }
                    }
                }
            }
        },

        setupTypeNumber: function (test) {
            var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
            var i, mod;

            for (i = 0; i < 18; i++) {
                mod = (!test && ((bits >> i) & 1) == 1);
                this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
            }
            for (i = 0; i < 18; i++) {
                mod = (!test && ((bits >> i) & 1) == 1);
                this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
            }
        },

        setupTypeInfo: function (test, maskPattern) {
            var data = (this.errorCorrectionLevel << 3) | maskPattern;
            var bits = QRUtil.getBCHTypeInfo(data);
            var i, mod;

            for (i = 0; i < 15; i++) {
                mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 6) {
                    this.modules[i][8] = mod;
                } else if (i < 8) {
                    this.modules[i + 1][8] = mod;
                } else {
                    this.modules[this.moduleCount - 15 + i][8] = mod;
                }
            }

            for (i = 0; i < 15; i++) {
                mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 8) {
                    this.modules[8][this.moduleCount - i - 1] = mod;
                } else if (i < 9) {
                    this.modules[8][15 - i - 1 + 1] = mod;
                } else {
                    this.modules[8][15 - i - 1] = mod;
                }
            }

            this.modules[this.moduleCount - 8][8] = (!test);
        },

        mapData: function (data, maskPattern) {
            var inc = -1;
            var row = this.moduleCount - 1;
            var bitIndex = 7;
            var byteIndex = 0;

            for (var col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col == 6) col--;

                while (true) {
                    for (var c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] == null) {
                            var dark = false;
                            if (byteIndex < data.length) {
                                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                            }
                            var mask = QRUtil.getMask(maskPattern, row, col - c);
                            if (mask) dark = !dark;
                            this.modules[row][col - c] = dark;
                            bitIndex--;
                            if (bitIndex == -1) {
                                byteIndex++;
                                bitIndex = 7;
                            }
                        }
                    }

                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc;
                        inc = -inc;
                        break;
                    }
                }
            }
        }
    };

    QRCode.PAD0 = 0xEC;
    QRCode.PAD1 = 0x11;

    QRCode.createData = function (typeNumber, errorCorrectionLevel, dataList) {
        var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
        var buffer = new QRBitBuffer();
        var i;

        for (i = 0; i < dataList.length; i++) {
            var data = dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
            data.write(buffer);
        }

        var totalDataCount = 0;
        for (i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
        }

        if (buffer.getLengthInBits() > totalDataCount * 8) {
            throw new Error("code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")");
        }

        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
            buffer.put(0, 4);
        }

        while (buffer.getLengthInBits() % 8 != 0) {
            buffer.putBit(false);
        }

        while (true) {
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(QRCode.PAD0, 8);
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(QRCode.PAD1, 8);
        }

        return QRCode.createBytes(buffer, rsBlocks);
    };

    QRCode.createBytes = function (buffer, rsBlocks) {
        var offset = 0;
        var maxDcCount = 0;
        var maxEcCount = 0;
        var dcdata = new Array(rsBlocks.length);
        var ecdata = new Array(rsBlocks.length);
        var r, i;

        for (r = 0; r < rsBlocks.length; r++) {
            var dcCount = rsBlocks[r].dataCount;
            var ecCount = rsBlocks[r].totalCount - dcCount;

            maxDcCount = Math.max(maxDcCount, dcCount);
            maxEcCount = Math.max(maxEcCount, ecCount);

            dcdata[r] = new Array(dcCount);
            for (i = 0; i < dcdata[r].length; i++) {
                dcdata[r][i] = 0xff & buffer.buffer[i + offset];
            }
            offset += dcCount;

            var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
            var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
            var modPoly = rawPoly.mod(rsPoly);

            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (i = 0; i < ecdata[r].length; i++) {
                var modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
            }
        }

        var totalCodeCount = 0;
        for (i = 0; i < rsBlocks.length; i++) {
            totalCodeCount += rsBlocks[i].totalCount;
        }

        var data = new Array(totalCodeCount);
        var index = 0;

        for (i = 0; i < maxDcCount; i++) {
            for (r = 0; r < rsBlocks.length; r++) {
                if (i < dcdata[r].length) data[index++] = dcdata[r][i];
            }
        }
        for (i = 0; i < maxEcCount; i++) {
            for (r = 0; r < rsBlocks.length; r++) {
                if (i < ecdata[r].length) data[index++] = ecdata[r][i];
            }
        }

        return data;
    };

    // ---- QRMode ----------------------------------------------------------
    var QRMode = {
        MODE_NUMBER: 1 << 0,
        MODE_ALPHA_NUM: 1 << 1,
        MODE_8BIT_BYTE: 1 << 2,
        MODE_KANJI: 1 << 3
    };

    // ---- QRErrorCorrectLevel ---------------------------------------------
    var QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

    // ---- QRMaskPattern ------------------------------------------------------
    var QRMaskPattern = {
        PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3,
        PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7
    };

    // ---- QRUtil ------------------------------------------------------------
    var QRUtil = {

        // COMPLETE Pattern Position Table — versions 1 through 40 (untruncated)
        PATTERN_POSITION_TABLE: [
            [],
            [6, 18],
            [6, 22],
            [6, 26],
            [6, 30],
            [6, 34],
            [6, 22, 38],
            [6, 24, 42],
            [6, 26, 46],
            [6, 28, 50],
            [6, 30, 54],
            [6, 32, 58],
            [6, 34, 62],
            [6, 26, 46, 66],
            [6, 26, 48, 70],
            [6, 26, 50, 74],
            [6, 30, 54, 78],
            [6, 30, 56, 82],
            [6, 30, 58, 86],
            [6, 34, 62, 90],
            [6, 28, 50, 72, 94],
            [6, 26, 50, 74, 98],
            [6, 30, 54, 78, 102],
            [6, 28, 54, 80, 106],
            [6, 32, 58, 84, 110],
            [6, 30, 58, 86, 114],
            [6, 34, 62, 90, 118],
            [6, 26, 50, 74, 98, 122],
            [6, 30, 54, 78, 102, 126],
            [6, 26, 52, 78, 104, 130],
            [6, 30, 56, 82, 108, 134],
            [6, 34, 60, 86, 112, 138],
            [6, 30, 58, 86, 114, 142],
            [6, 34, 62, 90, 118, 146],
            [6, 30, 54, 78, 102, 126, 150],
            [6, 24, 50, 76, 102, 128, 154],
            [6, 28, 54, 80, 106, 132, 158],
            [6, 32, 58, 84, 110, 136, 162],
            [6, 26, 54, 82, 110, 138, 166],
            [6, 30, 58, 86, 114, 142, 170]
        ],

        G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
        G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
        G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),

        getBCHTypeInfo: function (data) {
            var d = data << 10;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
                d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
            }
            return ((data << 10) | d) ^ QRUtil.G15_MASK;
        },

        getBCHTypeNumber: function (data) {
            var d = data << 12;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
                d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
            }
            return (data << 12) | d;
        },

        getBCHDigit: function (data) {
            var digit = 0;
            while (data != 0) {
                digit++;
                data >>>= 1;
            }
            return digit;
        },

        getPatternPosition: function (typeNumber) {
            return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
        },

        getMask: function (maskPattern, i, j) {
            switch (maskPattern) {
                case QRMaskPattern.PATTERN000: return (i + j) % 2 == 0;
                case QRMaskPattern.PATTERN001: return i % 2 == 0;
                case QRMaskPattern.PATTERN010: return j % 3 == 0;
                case QRMaskPattern.PATTERN011: return (i + j) % 3 == 0;
                case QRMaskPattern.PATTERN100: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
                case QRMaskPattern.PATTERN101: return (i * j) % 2 + (i * j) % 3 == 0;
                case QRMaskPattern.PATTERN110: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
                case QRMaskPattern.PATTERN111: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
                default: throw new Error("bad maskPattern:" + maskPattern);
            }
        },

        getErrorCorrectPolynomial: function (errorCorrectLength) {
            var a = new QRPolynomial([1], 0);
            for (var i = 0; i < errorCorrectLength; i++) {
                a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
            }
            return a;
        },

        getLengthInBits: function (mode, type) {
            if (1 <= type && type < 10) {
                switch (mode) {
                    case QRMode.MODE_NUMBER: return 10;
                    case QRMode.MODE_ALPHA_NUM: return 9;
                    case QRMode.MODE_8BIT_BYTE: return 8;
                    case QRMode.MODE_KANJI: return 8;
                    default: throw new Error("mode:" + mode);
                }
            } else if (type < 27) {
                switch (mode) {
                    case QRMode.MODE_NUMBER: return 12;
                    case QRMode.MODE_ALPHA_NUM: return 11;
                    case QRMode.MODE_8BIT_BYTE: return 16;
                    case QRMode.MODE_KANJI: return 10;
                    default: throw new Error("mode:" + mode);
                }
            } else if (type < 41) {
                switch (mode) {
                    case QRMode.MODE_NUMBER: return 14;
                    case QRMode.MODE_ALPHA_NUM: return 13;
                    case QRMode.MODE_8BIT_BYTE: return 16;
                    case QRMode.MODE_KANJI: return 12;
                    default: throw new Error("mode:" + mode);
                }
            } else {
                throw new Error("type:" + type);
            }
        },

        getLostPoint: function (qrCode) {
            var moduleCount = qrCode.getModuleCount();
            var lostPoint = 0;
            var row, col, r, c;

            for (row = 0; row < moduleCount; row++) {
                for (col = 0; col < moduleCount; col++) {
                    var sameCount = 0;
                    var dark = qrCode.isDark(row, col);

                    for (r = -1; r <= 1; r++) {
                        if (row + r < 0 || moduleCount <= row + r) continue;
                        for (c = -1; c <= 1; c++) {
                            if (col + c < 0 || moduleCount <= col + c) continue;
                            if (r == 0 && c == 0) continue;
                            if (dark == qrCode.isDark(row + r, col + c)) sameCount++;
                        }
                    }
                    if (sameCount > 5) lostPoint += (3 + sameCount - 5);
                }
            }

            for (row = 0; row < moduleCount - 1; row++) {
                for (col = 0; col < moduleCount - 1; col++) {
                    var count = 0;
                    if (qrCode.isDark(row, col)) count++;
                    if (qrCode.isDark(row + 1, col)) count++;
                    if (qrCode.isDark(row, col + 1)) count++;
                    if (qrCode.isDark(row + 1, col + 1)) count++;
                    if (count == 0 || count == 4) lostPoint += 3;
                }
            }

            for (row = 0; row < moduleCount; row++) {
                for (col = 0; col < moduleCount - 6; col++) {
                    if (qrCode.isDark(row, col)
                        && !qrCode.isDark(row, col + 1)
                        && qrCode.isDark(row, col + 2)
                        && qrCode.isDark(row, col + 3)
                        && qrCode.isDark(row, col + 4)
                        && !qrCode.isDark(row, col + 5)
                        && qrCode.isDark(row, col + 6)) {
                        lostPoint += 40;
                    }
                }
            }

            for (col = 0; col < moduleCount; col++) {
                for (row = 0; row < moduleCount - 6; row++) {
                    if (qrCode.isDark(row, col)
                        && !qrCode.isDark(row + 1, col)
                        && qrCode.isDark(row + 2, col)
                        && qrCode.isDark(row + 3, col)
                        && qrCode.isDark(row + 4, col)
                        && !qrCode.isDark(row + 5, col)
                        && qrCode.isDark(row + 6, col)) {
                        lostPoint += 40;
                    }
                }
            }

            var darkCount = 0;
            for (col = 0; col < moduleCount; col++) {
                for (row = 0; row < moduleCount; row++) {
                    if (qrCode.isDark(row, col)) darkCount++;
                }
            }

            var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
            lostPoint += ratio * 10;

            return lostPoint;
        }
    };

    // ---- QRMath --------------------------------------------------------------
    var QRMath = {

        glog: function (n) {
            if (n < 1) throw new Error("glog(" + n + ")");
            return QRMath.LOG_TABLE[n];
        },

        gexp: function (n) {
            while (n < 0) n += 255;
            while (n >= 256) n -= 255;
            return QRMath.EXP_TABLE[n];
        },

        EXP_TABLE: new Array(256),
        LOG_TABLE: new Array(256)
    };

    (function () {
        var i;
        for (i = 0; i < 8; i++) {
            QRMath.EXP_TABLE[i] = 1 << i;
        }
        for (i = 8; i < 256; i++) {
            QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
                ^ QRMath.EXP_TABLE[i - 5]
                ^ QRMath.EXP_TABLE[i - 6]
                ^ QRMath.EXP_TABLE[i - 8];
        }
        for (i = 0; i < 255; i++) {
            QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
        }
    })();

    // ---- QRPolynomial ----------------------------------------------------------
    function QRPolynomial(num, shift) {
        if (num.length == undefined) {
            throw new Error(num.length + "/" + shift);
        }
        var offset = 0;
        while (offset < num.length && num[offset] == 0) offset++;

        this.num = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i++) {
            this.num[i] = num[i + offset];
        }
    }

    QRPolynomial.prototype = {
        get: function (index) { return this.num[index]; },
        getLength: function () { return this.num.length; },
        multiply: function (e) {
            var num = new Array(this.getLength() + e.getLength() - 1);
            for (var i = 0; i < this.getLength(); i++) {
                for (var j = 0; j < e.getLength(); j++) {
                    num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
                }
            }
            return new QRPolynomial(num, 0);
        },
        mod: function (e) {
            if (this.getLength() - e.getLength() < 0) return this;

            var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
            var num = new Array(this.getLength());
            var i;
            for (i = 0; i < this.getLength(); i++) num[i] = this.get(i);
            for (i = 0; i < e.getLength(); i++) {
                num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
            }
            return new QRPolynomial(num, 0).mod(e);
        }
    };

    // ---- QRRSBlock ----------------------------------------------------------
    function QRRSBlock(totalCount, dataCount) {
        this.totalCount = totalCount;
        this.dataCount = dataCount;
    }

    // COMPLETE RS Block Table — versions 1 through 40, levels L / M / Q / H (untruncated)
    QRRSBlock.RS_BLOCK_TABLE = [

        // 1
        [1, 26, 19],
        [1, 26, 16],
        [1, 26, 13],
        [1, 26, 9],
        // 2
        [1, 44, 34],
        [1, 44, 28],
        [1, 44, 22],
        [1, 44, 16],
        // 3
        [1, 70, 55],
        [1, 70, 44],
        [2, 35, 17],
        [2, 35, 13],
        // 4
        [1, 100, 80],
        [2, 50, 32],
        [2, 50, 24],
        [4, 25, 9],
        // 5
        [1, 134, 108],
        [2, 67, 43],
        [2, 33, 15, 2, 34, 16],
        [2, 33, 11, 2, 34, 12],
        // 6
        [2, 86, 68],
        [4, 43, 27],
        [4, 43, 19],
        [4, 43, 15],
        // 7
        [2, 98, 78],
        [4, 49, 31],
        [2, 32, 14, 4, 33, 15],
        [4, 39, 13, 1, 40, 14],
        // 8
        [2, 121, 97],
        [2, 60, 38, 2, 61, 39],
        [4, 40, 18, 2, 41, 19],
        [4, 40, 14, 2, 41, 15],
        // 9
        [2, 146, 116],
        [3, 58, 36, 2, 59, 37],
        [4, 36, 16, 4, 37, 17],
        [4, 36, 12, 4, 37, 13],
        // 10
        [2, 86, 68, 2, 87, 69],
        [4, 69, 43, 1, 70, 44],
        [6, 43, 19, 2, 44, 20],
        [6, 43, 15, 2, 44, 16],
        // 11
        [4, 101, 81],
        [1, 80, 50, 4, 81, 51],
        [4, 50, 22, 4, 51, 23],
        [3, 36, 12, 8, 37, 13],
        // 12
        [2, 116, 92, 2, 117, 93],
        [6, 58, 36, 2, 59, 37],
        [4, 46, 20, 6, 47, 21],
        [7, 42, 14, 4, 43, 15],
        // 13
        [4, 133, 107],
        [8, 59, 37, 1, 60, 38],
        [8, 44, 20, 4, 45, 21],
        [12, 33, 11, 4, 34, 12],
        // 14
        [3, 145, 115, 1, 146, 116],
        [4, 64, 40, 5, 65, 41],
        [11, 36, 16, 5, 37, 17],
        [11, 36, 12, 5, 37, 13],
        // 15
        [5, 109, 87, 1, 110, 88],
        [5, 65, 41, 5, 66, 42],
        [5, 54, 24, 7, 55, 25],
        [11, 36, 12, 7, 37, 13],
        // 16
        [5, 122, 98, 1, 123, 99],
        [7, 73, 45, 3, 74, 46],
        [15, 43, 19, 2, 44, 20],
        [3, 45, 15, 13, 46, 16],
        // 17
        [1, 135, 107, 5, 136, 108],
        [10, 74, 46, 1, 75, 47],
        [1, 50, 22, 15, 51, 23],
        [2, 42, 14, 17, 43, 15],
        // 18
        [5, 150, 120, 1, 151, 121],
        [9, 69, 43, 4, 70, 44],
        [17, 50, 22, 1, 51, 23],
        [2, 42, 14, 19, 43, 15],
        // 19
        [3, 141, 113, 4, 142, 114],
        [3, 70, 44, 11, 71, 45],
        [17, 47, 21, 4, 48, 22],
        [9, 39, 13, 16, 40, 14],
        // 20
        [3, 135, 107, 5, 136, 108],
        [3, 67, 41, 13, 68, 42],
        [15, 54, 24, 5, 55, 25],
        [15, 43, 15, 10, 44, 16],
        // 21
        [4, 144, 116, 4, 145, 117],
        [17, 68, 42],
        [17, 50, 22, 6, 51, 23],
        [19, 46, 16, 6, 47, 17],
        // 22
        [2, 139, 111, 7, 140, 112],
        [17, 74, 46],
        [7, 54, 24, 16, 55, 25],
        [34, 37, 13],
        // 23
        [4, 151, 121, 5, 152, 122],
        [4, 75, 47, 14, 76, 48],
        [11, 54, 24, 14, 55, 25],
        [16, 45, 15, 14, 46, 16],
        // 24
        [6, 147, 117, 4, 148, 118],
        [6, 73, 45, 14, 74, 46],
        [11, 54, 24, 16, 55, 25],
        [30, 46, 16, 2, 47, 17],
        // 25
        [8, 132, 106, 4, 133, 107],
        [8, 75, 47, 13, 76, 48],
        [7, 54, 24, 22, 55, 25],
        [22, 45, 15, 13, 46, 16],
        // 26
        [10, 142, 114, 2, 143, 115],
        [19, 74, 46, 4, 75, 47],
        [28, 50, 22, 6, 51, 23],
        [33, 46, 16, 4, 47, 17],
        // 27
        [8, 152, 122, 4, 153, 123],
        [22, 73, 45, 3, 74, 46],
        [8, 53, 23, 26, 54, 24],
        [12, 45, 15, 28, 46, 16],
        // 28
        [3, 147, 117, 10, 148, 118],
        [3, 73, 45, 23, 74, 46],
        [4, 54, 24, 31, 55, 25],
        [11, 45, 15, 31, 46, 16],
        // 29
        [7, 146, 116, 7, 147, 117],
        [21, 73, 45, 7, 74, 46],
        [1, 53, 23, 37, 54, 24],
        [19, 45, 15, 26, 46, 16],
        // 30
        [5, 145, 115, 10, 146, 116],
        [19, 75, 47, 10, 76, 48],
        [15, 54, 24, 25, 55, 25],
        [23, 45, 15, 25, 46, 16],
        // 31
        [13, 145, 115, 3, 146, 116],
        [2, 74, 46, 29, 75, 47],
        [42, 54, 24, 1, 55, 25],
        [23, 45, 15, 28, 46, 16],
        // 32
        [17, 145, 115],
        [10, 74, 46, 23, 75, 47],
        [10, 54, 24, 35, 55, 25],
        [19, 45, 15, 35, 46, 16],
        // 33
        [17, 145, 115, 1, 146, 116],
        [14, 74, 46, 21, 75, 47],
        [29, 54, 24, 19, 55, 25],
        [11, 45, 15, 46, 46, 16],
        // 34
        [13, 145, 115, 6, 146, 116],
        [14, 74, 46, 23, 75, 47],
        [44, 54, 24, 7, 55, 25],
        [59, 46, 16, 1, 47, 17],
        // 35
        [12, 151, 121, 7, 152, 122],
        [12, 75, 47, 26, 76, 48],
        [39, 54, 24, 14, 55, 25],
        [22, 45, 15, 41, 46, 16],
        // 36
        [6, 151, 121, 14, 152, 122],
        [6, 75, 47, 34, 76, 48],
        [46, 54, 24, 10, 55, 25],
        [2, 45, 15, 64, 46, 16],
        // 37
        [17, 152, 122, 4, 153, 123],
        [29, 74, 46, 14, 75, 47],
        [49, 54, 24, 10, 55, 25],
        [24, 45, 15, 46, 46, 16],
        // 38
        [4, 152, 122, 18, 153, 123],
        [13, 74, 46, 32, 75, 47],
        [48, 54, 24, 14, 55, 25],
        [42, 45, 15, 32, 46, 16],
        // 39
        [20, 147, 117, 4, 148, 118],
        [40, 75, 47, 7, 76, 48],
        [43, 54, 24, 22, 55, 25],
        [10, 45, 15, 67, 46, 16],
        // 40
        [19, 148, 118, 6, 149, 119],
        [18, 75, 47, 31, 76, 48],
        [34, 54, 24, 34, 55, 25],
        [20, 45, 15, 61, 46, 16]
    ];

    QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectLevel) {
        var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
        if (rsBlock == undefined) {
            throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
        }

        var length = rsBlock.length / 3;
        var list = [];

        for (var i = 0; i < length; i++) {
            var count = rsBlock[i * 3 + 0];
            var totalCount = rsBlock[i * 3 + 1];
            var dataCount = rsBlock[i * 3 + 2];

            for (var j = 0; j < count; j++) {
                list.push(new QRRSBlock(totalCount, dataCount));
            }
        }
        return list;
    };

    QRRSBlock.getRsBlockTable = function (typeNumber, errorCorrectLevel) {
        switch (errorCorrectLevel) {
            case QRErrorCorrectLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
            case QRErrorCorrectLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
            case QRErrorCorrectLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
            case QRErrorCorrectLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
            default: return undefined;
        }
    };

    // ---- QRBitBuffer ----------------------------------------------------------
    function QRBitBuffer() {
        this.buffer = [];
        this.length = 0;
    }

    QRBitBuffer.prototype = {
        get: function (index) {
            var bufIndex = Math.floor(index / 8);
            return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1;
        },
        put: function (num, length) {
            for (var i = 0; i < length; i++) {
                this.putBit(((num >>> (length - i - 1)) & 1) == 1);
            }
        },
        getLengthInBits: function () { return this.length; },
        putBit: function (bit) {
            var bufIndex = Math.floor(this.length / 8);
            if (this.buffer.length <= bufIndex) this.buffer.push(0);
            if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
            this.length++;
        }
    };

    // ---- QR8bitByte ----------------------------------------------------------
    function QR8bitByte(data) {
        this.mode = QRMode.MODE_8BIT_BYTE;
        this.data = data;
        this.bytes = QR8bitByte.utf8Encode(data);
    }

    QR8bitByte.prototype = {
        getLength: function () { return this.bytes.length; },
        write: function (buffer) {
            for (var i = 0; i < this.bytes.length; i++) {
                buffer.put(this.bytes[i], 8);
            }
        }
    };

    QR8bitByte.utf8Encode = function (s) {
        var bytes = [];
        for (var n = 0; n < s.length; n++) {
            var c = s.charCodeAt(n);
            if (c < 128) {
                bytes.push(c);
            } else if (c < 2048) {
                bytes.push((c >> 6) | 192);
                bytes.push((c & 63) | 128);
            } else {
                bytes.push((c >> 12) | 224);
                bytes.push(((c >> 6) & 63) | 128);
                bytes.push((c & 63) | 128);
            }
        }
        return bytes;
    };

    // Finds the smallest QR version (1-40) that can hold the given text at the
    // requested error-correction level, so long URLs never overflow silently.
    function qr_getBestTypeNumber(dataStr, errorCorrectionLevel) {
        var ecValue = QRErrorCorrectLevel[errorCorrectionLevel];

        for (var typeNumber = 1; typeNumber <= 40; typeNumber++) {
            try {
                var testData = new QR8bitByte(dataStr);
                var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, ecValue);

                var buffer = new QRBitBuffer();
                buffer.put(testData.mode, 4);
                buffer.put(testData.getLength(), QRUtil.getLengthInBits(testData.mode, typeNumber));
                testData.write(buffer);

                var totalDataCount = 0;
                for (var i = 0; i < rsBlocks.length; i++) {
                    totalDataCount += rsBlocks[i].dataCount;
                }

                if (buffer.getLengthInBits() <= totalDataCount * 8) {
                    return typeNumber;
                }
            } catch (e) {
                // try the next (larger) version
            }
        }

        throw new Error("Text is too long to encode in a QR code, even at the maximum size.");
    }

    // ------------------------------------------------------------------
    // 2. STRINGS  (Hebrew-only panel)
    // ------------------------------------------------------------------

    var L = {
        title: "QR2Vector",
        subtitle1: "ממשק קליל ליצירת קוד סריקה וקטורי | טל נדב",
        subtitle2: "Simple QRcode2Vector Generator by TalNadav",
        subtitle3: "tal74design@gmail.com",
        urlLabel: "1. כתובת היעד (קישור):",
        sizeSectionLabel: "2. גודל ריבוע הקוד ליצירה",
        sizeLarge: "גדול",
        sizeMedium: "בינוני",
        sizeSmall: "קטן",
        optionsSectionLabel: "3. אפשרויות נוספות",
        whiteBgLabel: "הוספת רקע לבן",
        blankCircleLabel: "יצירת עיגול ריק במרכז\nלהוספת לוגו / סמל אישי",
        generateBtn: "יאללה תענוג!",
        cancelBtn: "ביטול",
        errNoDoc: "נא לפתוח מסמך באילוסטרייטור תחילה.",
        errNoUrl: "נא להזין כתובת אינטרנט או טקסט.",
        errGeneric: "אירעה שגיאה בעת יצירת קוד ה-QR:\n",
        successMsg: "קוד ה-QR נוצר בהצלחה!"
    };

    // ------------------------------------------------------------------
    // 2b. EMBEDDED UI ICONS
    //     Small base64-encoded PNGs for the custom square toggle controls
    //     (native ScriptUI radiobutton/checkbox widgets can't be resized
    //     or restyled, so we draw our own square "on/off" markers instead).
    // ------------------------------------------------------------------

    var ICON_OFF_B64 = "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAt0lEQVR4nO3YQQ6DMAxE0SmnogdD4ghIHAxu1a6MjCF0MUrjSPN3AaQ8mZ2B5L1+fTBN86cmYF2XR0PxZW1YrAS9PIywfd9qmQAA4/g+nSP0dPC42rCYh3rkcPfxv3FPdx5Am14LnGV3+z95O8FMDUCO6Vlxin1MMHMCsgnIJiCbgGwCsgnIJiCbgGwCsgnI1gfQdiFxkdMiM5ipjwkCOaYYpwcUJtgCWbqzrwWmL+0KONZ6iZ6+L7ugR0b3UrOEAAAAAElFTkSuQmCC";
    var ICON_ON_B64  = "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABKklEQVR4nO3YQQ6CMBAF0C+HMmz0UCQ9BYmHwg3xUroaLWOHdmiHloS/MVVIn1M7mAKN5xK7YJ5fb0tA319XDeKH1jAeCfr3JodN09PKBAC432+LMYcuBj7OGsbjQ31kF7p4b9zanF8gVa8GjkJz+ysZrGBL6YA2qkfhVTxGBVvOCfTj3KC+Zzcg4bTIXYAc5dyQDDUHSpBxfCTdX2WTpOIAY2CoehocYAjcsmNDMQHm/u78qIGxypTEAUpgrJeVxgEKYKiXrY0pOThAAQxNFFvuXBygXGIJWaKdSFFvklITp2ZTm4khS36JzX1QQpSucFajJgx/LZnsJ4klDjj/8uenA35nIfwgp0bIQKZjVBBoo4q8eoBQwRpIac5jHWD6afYImKf2IXrz+QAbZIZGohKrHQAAAABJRU5ErkJggg==";

    // Minimal base64 decoder — ExtendScript has no native atob()/Buffer.
    function base64ToBinaryString(input) {
        var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (i < input.length) {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output += String.fromCharCode(chr1);
            if (enc3 !== 64) output += String.fromCharCode(chr2);
            if (enc4 !== 64) output += String.fromCharCode(chr3);
        }
        return output;
    }

    // Writes a base64 PNG out to a temp file (once) and returns a File
    // reference to it, ready to hand to a ScriptUI iconbutton.
    function iconFileFromBase64(b64, fileName) {
        var f = new File(Folder.temp + "/" + fileName);
        if (!f.exists) {
            var bin = base64ToBinaryString(b64);
            f.encoding = "BINARY";
            f.open("w");
            f.write(bin);
            f.close();
        }
        return f;
    }

    // ------------------------------------------------------------------
    // 3. UI  (single-language, simplified panel)
    // ------------------------------------------------------------------

    var g_finalAction = null;   // "generate" | "cancel" | null
    var g_finalData = null;

    function buildAndShowDialog() {

        var align = "right";

        var win = new Window("dialog", L.title);
        win.orientation = "column";
        win.alignChildren = [align, "top"];
        win.margins = 18;
        win.spacing = 10;
        win.resizeable = false;

        // ---- Header: subtitle block (3 lines) -----------------------------
        var subGrp = win.add("group");
        subGrp.orientation = "column";
        subGrp.alignChildren = [align, "top"];
        subGrp.alignment = align;
        subGrp.spacing = 2;

        var sub1 = subGrp.add("statictext", undefined, L.subtitle1);
        sub1.justify = align;
        var sub2 = subGrp.add("statictext", undefined, L.subtitle2);
        sub2.justify = align;
        var sub3 = subGrp.add("statictext", undefined, L.subtitle3);
        sub3.justify = align;

        // ---- URL / text field --------------------------------------------
        var urlLabel = win.add("statictext", undefined, L.urlLabel);
        urlLabel.justify = align;
        urlLabel.preferredSize.width = 260;

        var urlInput = win.add("edittext", undefined, "https://");
        urlInput.characters = 30;
        urlInput.alignment = ["fill", "top"];
        try { urlInput.justify = align; } catch (eIgnore) {}

        // ---- Icon assets (decoded once per dialog build) ------------------
        var iconOff = iconFileFromBase64(ICON_OFF_B64, "qr2v_toggle_off.png");
        var iconOn = iconFileFromBase64(ICON_ON_B64, "qr2v_toggle_on.png");

        // ---- Size selection (3 single-select square toggles) ---------------
        var sizeLabel = win.add("statictext", undefined, L.sizeSectionLabel);
        sizeLabel.justify = align;
        sizeLabel.preferredSize.width = 260;

        var sizeRow = win.add("group");
        sizeRow.orientation = "row";
        sizeRow.alignment = align;
        sizeRow.spacing = 18;

        var selectedSizeIndex = 2; // default: "גדול" (960px)
        var sizeToggles = [];

        // Order matches the requested reading order: גדול, בינוני, קטן
        function addSizeToggle(parent, labelText, sizeIdx) {
            var g = parent.add("group");
            g.orientation = "row";
            g.alignChildren = ["left", "center"];
            g.spacing = 6;

            var icon = g.add("iconbutton", undefined, iconOff, { style: "toolbutton" });
            icon.preferredSize = [30, 30];

            var lbl = g.add("statictext", undefined, labelText);
            lbl.justify = align;

            var entry = { icon: icon, index: sizeIdx };

            function select() {
                selectedSizeIndex = sizeIdx;
                for (var k = 0; k < sizeToggles.length; k++) {
                    sizeToggles[k].icon.image = (sizeToggles[k].index === selectedSizeIndex) ? iconOn : iconOff;
                }
            }

            icon.onClick = select;
            // Clicking the label also selects — larger, easier click target.
            lbl.addEventListener("mousedown", select);

            return entry;
        }

        sizeToggles.push(addSizeToggle(sizeRow, L.sizeLarge, 2));
        sizeToggles.push(addSizeToggle(sizeRow, L.sizeMedium, 1));
        sizeToggles.push(addSizeToggle(sizeRow, L.sizeSmall, 0));

        // Apply the default visual state ("גדול" selected)
        sizeToggles[0].icon.image = iconOn;

        // ---- Additional options (independent square toggles) -----------------
        var optionsLabel = win.add("statictext", undefined, L.optionsSectionLabel);
        optionsLabel.justify = align;
        optionsLabel.preferredSize.width = 260;

        function addOptionToggle(parent, labelText) {
            var g = parent.add("group");
            g.orientation = "row";
            g.alignChildren = ["left", "top"];
            g.alignment = align;
            g.spacing = 6;

            var icon = g.add("iconbutton", undefined, iconOff, { style: "toolbutton" });
            icon.preferredSize = [30, 30];

            var lbl = g.add("statictext", undefined, labelText, { multiline: true });
            lbl.justify = align;
            lbl.preferredSize.width = 210;

            var state = false;

            function toggle() {
                state = !state;
                icon.image = state ? iconOn : iconOff;
            }

            icon.onClick = toggle;
            // Clicking the label also toggles — larger, easier click target.
            lbl.addEventListener("mousedown", toggle);

            return {
                icon: icon,
                getValue: function () { return state; }
            };
        }

        var whiteBgToggle = addOptionToggle(win, L.whiteBgLabel);
        var blankCircleToggle = addOptionToggle(win, L.blankCircleLabel);

        // ---- Buttons -----------------------------------------------------------
        var btnRow = win.add("group");
        btnRow.orientation = "row";
        btnRow.alignment = "center";
        btnRow.spacing = 10;

        var generateBtn = btnRow.add("button", undefined, L.generateBtn, { name: "ok" });
        generateBtn.preferredSize.width = 200;
        generateBtn.preferredSize.height = 40;

        var cancelBtn = btnRow.add("button", undefined, L.cancelBtn, { name: "cancel" });
        cancelBtn.preferredSize.width = 100;
        cancelBtn.preferredSize.height = 40;

        // ---- Event handlers --------------------------------------------------
        cancelBtn.onClick = function () {
            g_finalAction = "cancel";
            win.close(0);
        };

        generateBtn.onClick = function () {
            g_finalAction = "generate";
            g_finalData = {
                url: urlInput.text,
                sizeIndex: selectedSizeIndex,
                colorIndex: 0,   // color picker removed from UI — always black
                blankCircle: blankCircleToggle.getValue(),
                whiteBg: whiteBgToggle.getValue()
            };
            win.close(1);
        };

        win.onClose = function () {
            if (g_finalAction === null) g_finalAction = "cancel";
        };

        win.show();
    }

    // ------------------------------------------------------------------
    // 4. VECTOR RENDERING
    // ------------------------------------------------------------------

    function getFillColor(colorIndex) {
        var c = new CMYKColor();
        switch (colorIndex) {
            case 1: // blue
                c.cyan = 90; c.magenta = 80; c.yellow = 0; c.black = 0;
                break;
            case 2: // pink
                c.cyan = 20; c.magenta = 95; c.yellow = 0; c.black = 0;
                break;
            case 0: // black
            default:
                c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 100;
                break;
        }
        return c;
    }

    // Returns a layer that is guaranteed unlocked and visible, so drawing never
    // fails with Illustrator's "Target layer cannot be modified" error (which
    // happens when the previously-active layer is locked and/or hidden).
    function getOrCreateQRLayer(doc) {
        var layerName = "QR2Vector Pro";
        var existing = null;

        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                existing = doc.layers[i];
                break;
            }
        }

        var qrLayer;
        if (existing && !existing.locked) {
            qrLayer = existing;
        } else {
            qrLayer = doc.layers.add();
            qrLayer.name = existing ? (layerName + " " + (new Date()).getTime()) : layerName;
        }

        qrLayer.locked = false;
        qrLayer.visible = true;
        doc.activeLayer = qrLayer;

        return qrLayer;
    }

    function generateQRVector(data) {
        try {
            if (app.documents.length === 0) {
                alert(L.errNoDoc);
                return;
            }

            var text = data.url;
            var trimmed = text.replace(/^\s+|\s+$/g, "");
            if (!text || trimmed === "") {
                alert(L.errNoUrl);
                return;
            }

            var doc = app.activeDocument;

            var sizes = [320, 640, 960];
            var totalSize = sizes[data.sizeIndex] || 640;

            // High error-correction is forced whenever a logo hole is requested,
            // so the code stays scannable even with a chunk missing.
            var ecLevel = data.blankCircle ? "H" : "M";

            var typeNumber = qr_getBestTypeNumber(text, ecLevel);
            var qr = new QRCode(typeNumber, ecLevel);
            qr.addData(text);
            qr.make();

            var moduleCount = qr.getModuleCount();
            var moduleSize = totalSize / moduleCount;

            var fillColor = getFillColor(data.colorIndex);

            // Center the code on the current view — the same point Illustrator's
            // own Edit > Paste (without "Paste in Place") drops content onto —
            // rather than a fixed artboard position.
            var view = doc.views[0];
            var centerX = view.centerPoint[0];
            var centerY = view.centerPoint[1];

            var startX = centerX - totalSize / 2;
            var startY = centerY + totalSize / 2;

            var qrLayer = getOrCreateQRLayer(doc);
            var qrGroup = qrLayer.groupItems.add();
            qrGroup.name = "QR2Vector Pro - " + text;

            // ---- Optional white background / quiet zone (2-module pad) ------
            if (data.whiteBg) {
                var pad = moduleSize * 2;
                var bgRect = qrGroup.pathItems.rectangle(
                    startY + pad,
                    startX - pad,
                    totalSize + pad * 2,
                    totalSize + pad * 2
                );
                bgRect.filled = true;
                bgRect.stroked = false;
                var white = new CMYKColor();
                white.cyan = 0; white.magenta = 0; white.yellow = 0; white.black = 0;
                bgRect.fillColor = white;
                bgRect.zOrder(ZOrderMethod.SENDTOBACK);
            }

            // ---- Optional blank circle for a logo (~15% radius) -----------------
            var drawHole = data.blankCircle;
            var centerMod = moduleCount / 2;
            var holeRadius = moduleCount * 0.15;

            for (var row = 0; row < moduleCount; row++) {
                for (var col = 0; col < moduleCount; col++) {
                    if (!qr.isDark(row, col)) continue;

                    if (drawHole) {
                        var dRow = row - centerMod;
                        var dCol = col - centerMod;
                        var dist = Math.sqrt(dRow * dRow + dCol * dCol);
                        if (dist <= holeRadius) continue;
                    }

                    var left = startX + col * moduleSize;
                    var top = startY - row * moduleSize;

                    var rect = qrGroup.pathItems.rectangle(top, left, moduleSize, moduleSize);
                    rect.filled = true;
                    rect.stroked = false;
                    rect.fillColor = fillColor;
                }
            }

            app.redraw();
            alert(L.successMsg);

        } catch (err) {
            alert(L.errGeneric + err.message);
        }
    }

    // ------------------------------------------------------------------
    // 5. MAIN
    // ------------------------------------------------------------------

    buildAndShowDialog();

    if (g_finalAction === "generate" && g_finalData) {
        generateQRVector(g_finalData);
    }

})();
