export const ErrorMessages = {
    invalidPageNumber: "Introduce un número de página.",
    integersOnly: "Solo se permiten enteros.",
    pageRange: (min: number, max: number) =>
        `El valor debe estar entre ${min} y ${max}.`,
    saveNeos: "Error al guardar los datos.",
    downloadFallback:
        "No pudimos abrir el archivo. Se descargará en su lugar.",
    toggleImportant: "Error al alternar favorito",
    emptyNeos: "No se han cargado los datos todavía.",
    genericFetch: "Error al obtener los datos.",
};
