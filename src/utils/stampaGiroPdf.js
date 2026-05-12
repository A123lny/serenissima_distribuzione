import jsPDF from 'jspdf'

function slugify(str) {
  return (str || 'giro')
    .toString()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'giro'
}

export function stampaGiroPdf(giro) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 18
  const marginTop = 20
  const marginBottom = 18
  const contentWidth = pageWidth - marginX * 2

  let y = marginTop

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - marginBottom) {
      pdf.addPage()
      y = marginTop
    }
  }

  // Titolo: nome del giro
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  const titolo = giro?.nome_giro || 'Giro senza nome'
  const titoloLines = pdf.splitTextToSize(titolo, contentWidth)
  pdf.text(titoloLines, marginX, y)
  y += titoloLines.length * 8 + 4

  // Linea separatrice
  pdf.setDrawColor(180)
  pdf.setLineWidth(0.4)
  pdf.line(marginX, y, pageWidth - marginX, y)
  y += 8

  const zone = giro?.zone || []

  if (zone.length === 0) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(11)
    pdf.setTextColor(120)
    pdf.text('Nessuna zona associata a questo giro.', marginX, y)
  }

  zone.forEach((zona) => {
    const localita = zona.localita || []

    // Titolo zona
    ensureSpace(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(40)
    const nomeZona = (zona.nome_zona || 'Zona').toUpperCase()
    pdf.text(nomeZona, marginX, y)
    y += 6

    if (localita.length === 0) {
      ensureSpace(6)
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(10)
      pdf.setTextColor(140)
      pdf.text('(nessuna localita)', marginX + 4, y)
      y += 6
      return
    }

    // Lista localita della zona
    localita.forEach((loc) => {
      const nome = loc.nome_locale || '(senza nome)'
      const note = (loc.note || '').trim()

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.setTextColor(20)

      const bulletX = marginX + 2
      const textX = marginX + 6
      const textWidth = contentWidth - 6

      const nomeLines = pdf.splitTextToSize(nome, textWidth)
      ensureSpace(nomeLines.length * 5 + (note ? 5 : 0) + 2)

      pdf.text('-', bulletX, y)
      pdf.text(nomeLines, textX, y)
      y += nomeLines.length * 5

      if (note) {
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(10)
        pdf.setTextColor(90)
        const noteLines = pdf.splitTextToSize(note, textWidth - 4)
        ensureSpace(noteLines.length * 4.5 + 1)
        pdf.text(noteLines, textX + 2, y)
        y += noteLines.length * 4.5
      }

      y += 1.5
    })

    y += 4
  })

  // Footer: numero pagina su ogni pagina
  const totalPages = pdf.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(150)
    pdf.text(`${i} / ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' })
  }

  pdf.save(`giro-${slugify(giro?.nome_giro)}.pdf`)
}
