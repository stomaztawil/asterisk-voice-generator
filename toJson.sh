#!/bin/bash

# Script para converter arquivo de sons do Asterisk para JSON
# Formato de entrada: /caminho/completo/para/arquivo : Texto de fala
# Formato de saída: [{"path": "...", "fileName": "...", "speechText": "..."}, ...]

# Verificar se foi fornecido um arquivo de entrada
if [ $# -ne 1 ]; then
    echo "Uso: $0 <arquivo_de_entrada>"
    exit 1
fi

input_file="$1"
output_file="${input_file%.*}.json"

# Processar o arquivo e gerar JSON
awk -F' : ' '
BEGIN {
    print "["
    first = 1
}
{
    # Ignorar linhas vazias
    if (NF < 2) next
    
    # Extrair caminho completo e nome do arquivo
    fullpath = $1
    text = substr($0, length($1) + 4)
    
    # Extrair path e filename usando split
    n = split(fullpath, parts, "/")
    if (n > 1) {
        filename = parts[n]
        path = fullpath
        sub("/" filename "$", "", path)
    } else {
        path = ""
        filename = fullpath
    }
    
    # Remover possíveis espaços extras
    gsub(/^[ \t]+|[ \t]+$/, "", text)
    
    # Escape de caracteres especiais para JSON
    gsub(/"/, "\\\"", text)
    gsub(/\\/, "\\\\", text)
    
    # Imprimir separador de objetos
    if (!first) {
        print ","
    } else {
        first = 0
    }
    
    # Imprimir objeto JSON
    printf "  {\n"
    printf "    \"path\": \"%s\",\n", path
    printf "    \"fileName\": \"%s\",\n", filename
    printf "    \"speechText\": \"%s\"\n", text
    printf "  }"
}
END {
    print "\n]"
}' "$input_file" > "$output_file"

echo "Conversão concluída! Saída salva em: $output_file"
