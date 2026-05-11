'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useRef, DragEvent, ChangeEvent, useCallback, useMemo } from 'react';
import Papa from 'papaparse';

interface ValidationError {
  rowNumber: number;
  column: string;
  message: string;
}

// Definisikan State Alur Aplikasi
type AppStep = 'UPLOAD' | 'COLUMN_SELECTION' | 'RESULTS';

export default function Home() {
  // State Utama
  const [appStep, setAppStep] = useState<AppStep>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // State Data
  const [csvData, setCsvData] = useState<any[]>([]);
  const [errorList, setErrorList] = useState<ValidationError[]>([]);
  
  // State Kolom (Baru)
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // TAHAP 1: Parsing CSV hanya untuk mendapatkan Header & Data mentah
  const processCSV = (selectedFile: File) => {
    setIsProcessing(true);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        
        // Ambil header yang terdeteksi otomatis oleh PapaParse
        const headers = results.meta.fields || [];
        setAvailableColumns(headers);
        setSelectedColumns(headers); // Secara default, ceklis semua kolom
        
        setIsProcessing(false);
        setAppStep('COLUMN_SELECTION'); // Pindah ke layar pemilihan kolom
      },
      error: (error) => {
        console.error('Error saat membaca CSV:', error);
        alert('Terjadi kesalahan saat membaca file CSV.');
        setIsProcessing(false);
      }
    });
  };

  // TAHAP 2: Handler untuk Ceklis Kolom
  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col) 
        : [...prev, col]
    );
  };

  const handleSelectAll = (select: boolean) => {
    if (select) setSelectedColumns([...availableColumns]);
    else setSelectedColumns([]);
  };

  // TAHAP 3: Validasi berdasarkan kolom yang dipilih
  const executeValidation = useCallback(() => {
    setIsProcessing(true);
    
    // Gunakan setTimeout agar UI loading spinner sempat ter-render sebelum CPU sibuk melooping data
    setTimeout(() => {
      const errors: ValidationError[] = [];
      const seenRecords = new Map<string, number>();

      csvData.forEach((row, index) => {
        const rowNumber = index + 2; 

        // 1. Cek Missing Value HANYA pada kolom yang diceklis
        selectedColumns.forEach((header) => {
          const cellValue = row[header];
          if (cellValue === undefined || cellValue === null || String(cellValue).trim() === '') {
            errors.push({
              rowNumber,
              column: header,
              message: `Data pada kolom '${header}' tidak boleh kosong.`
            });
          }
        });

        // 2. Cek Logic Error (Hanya jalan JIKA Total_Siswa & Peserta_Hadir diceklis)
        if (selectedColumns.includes('Total_Siswa') && selectedColumns.includes('Peserta_Hadir')) {
          const totalSiswa = parseInt(row['Total_Siswa'], 10);
          const pesertaHadir = parseInt(row['Peserta_Hadir'], 10);

          if (!isNaN(totalSiswa) && !isNaN(pesertaHadir) && pesertaHadir > totalSiswa) {
            errors.push({
              rowNumber,
              column: 'Peserta_Hadir',
              message: `Angka tidak logis: Peserta Hadir (${pesertaHadir}) lebih besar dari Total Siswa (${totalSiswa}).`
            });
          }
        }

        // 3. Cek Duplicate Row (Hanya jalan JIKA Tanggal & ID_Sekolah diceklis)
        if (selectedColumns.includes('Tanggal') && selectedColumns.includes('ID_Sekolah')) {
          const tanggal = String(row['Tanggal'] || '').trim();
          const idSekolah = String(row['ID_Sekolah'] || '').trim();

          if (tanggal && idSekolah) {
            const uniqueKey = `${tanggal}_${idSekolah}`;
            if (seenRecords.has(uniqueKey)) {
              const previousRow = seenRecords.get(uniqueKey);
              errors.push({
                rowNumber,
                column: 'Tanggal & ID_Sekolah',
                message: `Duplikasi data! ID Sekolah '${idSekolah}' sudah ada pada tanggal '${tanggal}' di baris ${previousRow}.`
              });
            } else {
              seenRecords.set(uniqueKey, rowNumber);
            }
          }
        }
      });

      setErrorList(errors);
      setIsProcessing(false);
      setAppStep('RESULTS'); // Pindah ke dashboard hasil
    }, 100);
  }, [csvData, selectedColumns]);


  // Download Laporan
  const downloadErrorCSV = () => {
    if (errorList.length === 0) return;
    const csvString = Papa.unparse(errorList);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Laporan_Error_Literasi.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset Semua State
  const handleClearFile = () => {
    setFile(null);
    setCsvData([]);
    setErrorList([]);
    setAvailableColumns([]);
    setSelectedColumns([]);
    setAppStep('UPLOAD');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handlers Input
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile); processCSV(droppedFile);
      } else alert('Mohon unggah file dengan format .csv');
    }
  };
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile); processCSV(selectedFile);
    }
  };

  // Statistik
  const stats = useMemo(() => {
    const totalRows = csvData.length;
    const errorRowsSet = new Set(errorList.map(err => err.rowNumber));
    const errorRowsCount = errorRowsSet.size;
    const validRowsCount = totalRows - errorRowsCount;
    return { totalRows, validRowsCount, errorRowsCount };
  }, [csvData, errorList]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20">
      <header className="bg-teal-700 text-white py-10 px-4 text-center shadow-md">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">Portal Validasi Data Literasi</h1>
          <p className="text-teal-100 flex items-center justify-center gap-2 text-sm md:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Aman & Privat: Data diproses di perangkat Anda.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-10 p-6">
        
        {/* STEP 1: UPLOAD AREA */}
        {appStep === 'UPLOAD' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
            {!isProcessing ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out
                  ${isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mb-4 ${isDragging ? 'text-teal-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-gray-700 mb-1">Tarik dan lepas file CSV Anda di sini</p>
                <p className="text-sm text-gray-500 mb-6">atau klik tombol di bawah untuk mencari file</p>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileInput} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-sm transition-colors">Pilih File</button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-teal-600">
                <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-lg font-medium animate-pulse">Membaca file CSV...</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: COLUMN SELECTION */}
        {appStep === 'COLUMN_SELECTION' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Pilih Kolom Validasi</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Kami mendeteksi <strong>{availableColumns.length} kolom</strong> pada file <span className="font-semibold text-teal-700">{file?.name}</span>. 
                  Centang kolom yang ingin divalidasi.
                </p>
              </div>
              <button onClick={handleClearFile} className="text-gray-400 hover:text-red-500 transition-colors" title="Batal / Ganti File">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex gap-3 mb-6">
              <button onClick={() => handleSelectAll(true)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium">Pilih Semua</button>
              <button onClick={() => handleSelectAll(false)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium">Hapus Pilihan</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {availableColumns.map((col, idx) => (
                <label key={idx} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all
                  ${selectedColumns.includes(col) ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                    checked={selectedColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                  />
                  <span className={`font-medium break-all ${selectedColumns.includes(col) ? 'text-teal-900' : 'text-gray-600'}`}>
                    {col || `(Kolom Tanpa Nama ${idx + 1})`}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button 
                onClick={executeValidation} 
                disabled={selectedColumns.length === 0 || isProcessing}
                className="px-8 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-lg rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Memvalidasi...
                  </>
                ) : (
                  `Mulai Validasi (${selectedColumns.length} Kolom)`
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTS DASHBOARD */}
        {appStep === 'RESULTS' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Laporan Validasi Data</h2>
                <p className="text-gray-500 mt-1">File: <span className="font-semibold">{file?.name}</span> • Memvalidasi {selectedColumns.length} kolom.</p>
              </div>
              <button onClick={handleClearFile} className="px-5 py-2.5 bg-white border-2 border-teal-600 text-teal-700 hover:bg-teal-50 font-medium rounded-lg transition-colors whitespace-nowrap">
                Cek File Lain
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <p className="text-sm text-gray-500 font-medium mb-1">Total Baris Diproses</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalRows.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl shadow-sm border border-green-200 flex flex-col justify-center">
                <p className="text-sm text-green-700 font-medium mb-1">Baris Valid</p>
                <p className="text-3xl font-bold text-green-700">{stats.validRowsCount.toLocaleString()}</p>
              </div>
              <div className={`p-6 rounded-2xl shadow-sm border flex flex-col justify-center ${stats.errorRowsCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                <p className={`text-sm font-medium mb-1 ${stats.errorRowsCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>Baris Bermasalah</p>
                <p className={`text-3xl font-bold ${stats.errorRowsCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.errorRowsCount.toLocaleString()}</p>
              </div>
            </div>

            {errorList.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-800 text-lg">Daftar Temuan Error</h3>
                    <span className="text-sm text-red-600 font-medium bg-red-100 px-3 py-1 rounded-full">Total: {errorList.length.toLocaleString()} Error</span>
                  </div>
                  <button onClick={downloadErrorCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Error (CSV)
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 font-medium border-b border-gray-200">Baris Excel</th>
                        <th className="px-6 py-3 font-medium border-b border-gray-200">Kolom</th>
                        <th className="px-6 py-3 font-medium border-b border-gray-200 w-full">Detail Kesalahan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {errorList.slice(0, 100).map((error, index) => (
                        <tr key={index} className="hover:bg-red-50/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-700">Baris {error.rowNumber}</td>
                          <td className="px-6 py-4 text-red-600 font-medium">{error.column}</td>
                          <td className="px-6 py-4 text-gray-600 whitespace-normal">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {errorList.length > 100 && (
                  <div className="bg-yellow-50 text-yellow-800 text-center py-3 text-sm border-t border-yellow-200">
                    ⚠️ Menampilkan 100 error pertama. Download laporan CSV untuk melihat seluruh <strong>{errorList.length.toLocaleString()}</strong> error.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-green-50 rounded-2xl border border-green-200 p-10 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-green-800 mb-2">Data Bersih dan Valid!</h3>
                <p className="text-green-700">Tidak ada missing value atau logic error pada kolom yang dipilih.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}