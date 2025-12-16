const API_BASE_URL = 'http://localhost:3001/api';

class DocumentSigner {
    constructor() {
        this.files = [];
        this.signatureFile = null;
        this.signatureBase64 = null;
        this.selectedPosition = null;
        this.currentDocument = null;
        this.recommendedSize = { width: 150, height: 50 };
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('signatureInput').addEventListener('change', (e) => this.handleSignatureSelect(e));
        document.getElementById('processDocuments').addEventListener('click', () => this.processDocuments());
    }
    
    getSignatureSize() {
        return this.recommendedSize;
    }

    handleSignatureSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        this.signatureFile = file;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            this.signatureBase64 = event.target.result;
            this.displaySignaturePreview(event.target.result);
        };
        reader.readAsDataURL(file);
    }

    displaySignaturePreview(base64) {
        const preview = document.getElementById('signaturePreview');
        preview.innerHTML = `
            <div>
                <p>Assinatura carregada:</p>
                <img src="${base64}" alt="Assinatura">
            </div>
        `;
        this.checkReadyToProcess();
    }
    
    async generatePreview(file) {
        try {
            const formData = new FormData();
            formData.append('document', file);
            
            const response = await fetch(`${API_BASE_URL}/preview`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.currentDocument = {
                    file: file,
                    htmlContent: result.htmlContent
                };
                this.recommendedSize = result.recommendedSize;
                this.displayDocumentPreview(result.htmlContent);
                this.showDetectedSize();
            } else {
                this.showError('Erro ao gerar preview: ' + result.error);
            }
        } catch (error) {
            this.showError('Erro de conexão: ' + error.message);
        }
    }
    
    displayDocumentPreview(htmlContent) {
        const previewDiv = document.getElementById('documentPreview');
        const contentDiv = document.getElementById('previewContent');
        
        // Processar HTML para simular documento oficial
        const processedHtml = this.formatHtmlForDocument(htmlContent);
        contentDiv.innerHTML = processedHtml;
        previewDiv.style.display = 'block';
        
        // Adicionar evento de clique
        contentDiv.addEventListener('click', (e) => this.selectSignaturePosition(e));
    }
    
    formatHtmlForDocument(html) {
        return html
            .replace(/<p>/g, '<p style="margin: 0 0 8px 0; line-height: 1.2; font-size: 11px; font-family: Times, serif;">')
            .replace(/<strong>/g, '<strong style="font-weight: bold;">')
            .replace(/<em>/g, '<em style="font-style: italic;">');
    }
    
    showDetectedSize() {
        const sizeInfo = document.getElementById('sizeInfo');
        const detectedSize = document.getElementById('detectedSize');
        
        detectedSize.textContent = `${this.recommendedSize.width}x${this.recommendedSize.height} pixels`;
        sizeInfo.style.display = 'block';
    }
    
    selectSignaturePosition(e) {
        const contentDiv = document.getElementById('previewContent');
        const rect = contentDiv.getBoundingClientRect();
        
        // Calcular posição relativa no preview
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Remover marcador anterior
        const existingMarker = contentDiv.querySelector('.signature-marker');
        if (existingMarker) {
            existingMarker.remove();
        }
        
        // Obter tamanho da assinatura
        const signatureSize = this.getSignatureSize();
        const signatureWidth = signatureSize.width;
        const signatureHeight = signatureSize.height;
        
        // Converter para coordenadas PDF A4 (595x842)
        const scaleX = 595 / contentDiv.clientWidth;
        const scaleY = 842 / contentDiv.clientHeight;
        
        const pdfX = clickX * scaleX;
        const pdfY = clickY * scaleY;
        
        // Centralizar assinatura no clique
        const finalX = Math.max(0, Math.min(pdfX - signatureWidth/2, 595 - signatureWidth));
        const finalY = Math.max(0, Math.min(pdfY - signatureHeight/2, 842 - signatureHeight));
        
        // Criar marcador visual
        const marker = document.createElement('div');
        marker.className = 'signature-marker';
        marker.style.position = 'absolute';
        marker.style.left = `${clickX - signatureWidth/2}px`;
        marker.style.top = `${clickY - signatureHeight/2}px`;
        marker.style.width = `${signatureWidth}px`;
        marker.style.height = `${signatureHeight}px`;
        marker.style.zIndex = '1000';
        marker.textContent = 'Assinatura';
        
        contentDiv.appendChild(marker);
        
        // Coordenadas para o PDF
        this.selectedPosition = {
            x: finalX,
            y: finalY
        };
        
        console.log('=== DEBUG POSICIONAMENTO ===');
        console.log('Clique:', { x: clickX, y: clickY });
        console.log('Preview size:', { w: contentDiv.clientWidth, h: contentDiv.clientHeight });
        console.log('Escala:', { x: scaleX, y: scaleY });
        console.log('PDF coordenadas:', this.selectedPosition);
        console.log('============================');
        
        this.checkReadyToProcess();
    }
    
    checkReadyToProcess() {
        const processBtn = document.getElementById('processDocuments');
        if (this.signatureBase64 && this.selectedPosition && this.currentDocument) {
            processBtn.style.display = 'block';
        }
    }

    async handleFileSelect(e) {
        this.files = Array.from(e.target.files);
        this.displayFileList();
        
        // Gerar preview do primeiro arquivo
        if (this.files.length > 0) {
            await this.generatePreview(this.files[0]);
        }
    }

    displayFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.textContent = `${index + 1}. ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            fileList.appendChild(fileItem);
        });
    }

    getSelectedPosition() {
        const selectedPosition = document.querySelector('input[name="position"]:checked');
        return selectedPosition ? selectedPosition.value : 'bottom-right';
    }
    
    getPositionCoordinates(position) {
        const positions = {
            'bottom-right': { x: 450, y: 750 },
            'bottom-left': { x: 50, y: 750 },
            'top-right': { x: 450, y: 50 },
            'top-left': { x: 50, y: 50 },
            'center': { x: 300, y: 400 }
        };
        return positions[position] || positions['bottom-right'];
    }

    async processDocuments() {
        if (!this.currentDocument) {
            this.showError('Selecione um documento');
            return;
        }

        if (!this.signatureBase64) {
            this.showError('Selecione uma assinatura PNG');
            return;
        }
        
        if (!this.selectedPosition) {
            this.showError('Clique no documento para selecionar a posição da assinatura');
            return;
        }

        this.showLoading(true);
        this.clearResults();

        try {
            const signatureSize = this.getSignatureSize();
            
            const formData = new FormData();
            formData.append('document', this.currentDocument.file);
            formData.append('signature', this.signatureBase64);
            formData.append('positionX', this.selectedPosition.x.toString());
            formData.append('positionY', this.selectedPosition.y.toString());
            formData.append('signatureWidth', signatureSize.width.toString());
            formData.append('signatureHeight', signatureSize.height.toString());
            
            console.log('Processando com posição:', this.selectedPosition);

            const response = await fetch(`${API_BASE_URL}/upload-file`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showSuccess({
                    total_documentos: 1,
                    documentos: [result.documento],
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error(result.error || 'Erro no processamento');
            }

        } catch (error) {
            console.error('Erro:', error);
            this.showError('Erro no processamento: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }



    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    clearResults() {
        document.getElementById('results').innerHTML = '';
    }

    showSuccess(result) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div class="result-item">
                <h3>✅ Processamento Concluído</h3>
                <p><strong>Total de documentos:</strong> ${result.total_documentos}</p>
                <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
                <div style="margin-top: 15px;">
                    <strong>Downloads disponíveis:</strong>
                    <div class="download-list" style="margin-top: 10px;">
                        ${result.documentos.map((doc, index) => 
                            `<div class="download-item">
                                <span>${doc.nome} → ${doc.arquivo_final}</span>
                                <button onclick="downloadDocument('${doc.nome}', ${index})" class="download-btn">
                                    📥 Baixar PDF
                                </button>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    showError(message) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div class="result-item error">
                <h3>❌ Erro</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

// Função global para download
window.downloadDocument = async function(fileName, index) {
    try {
        const downloadUrl = `${API_BASE_URL}/download/${encodeURIComponent(fileName)}`;
        console.log('Tentando baixar de:', downloadUrl);
        
        // Primeiro testar se a API está funcionando
        const testResponse = await fetch(`${API_BASE_URL}/test`);
        if (!testResponse.ok) {
            alert('API não está funcionando. Verifique se está rodando na porta 3001');
            return;
        }
        
        const response = await fetch(downloadUrl, {
            method: 'GET'
        });
        
        console.log('Status da resposta:', response.status);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace('.docx', '_assinado.pdf');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            const errorText = await response.text();
            console.error('Erro no download:', errorText);
            alert(`Erro ao baixar o arquivo: ${response.status}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('Erro de conexão: ' + error.message);
    }
};

// Inicializar a aplicação
document.addEventListener('DOMContentLoaded', () => {
    new DocumentSigner();
});