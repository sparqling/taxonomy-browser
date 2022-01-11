function get_table_row(genome_record) {
  let assembly_url = '';
  if (genome_record.assembly) {
    assembly_url = 'https://ncbi.nlm.nih.gov/assembly/' + genome_record.assembly;
  }
  
  let checkedAttr = selectedTaxa[genome_record.up_id] ? "checked" : "";

  let scientific_name = genome_record.organism_name;
  let common_name = '';
  if (scientific_name.match(/(.*)?(\(.*)/)) {
    scientific_name = RegExp.$1;
    common_name = RegExp.$2;
  }
  let name = `<i>${scientific_name}</i> ${common_name}`;

  let list_html = '<tr>';
  list_html += `<td align="center"><input type="checkbox" class="add_genome" ${checkedAttr} title="Select"></td>`;
  if (genome_record.types.match(/Reference_Proteome/)) {
    list_html += '<td align="center"> &#9675 </td>';
  } else {
    list_html += '<td> </td>';
  }
  // if (types.match(/Representative_Proteome/)) {
  //   list_html += '<td align="center"> &#9675 </td>';
  // } else {
  //   list_html += '<td> </td>';
  // }
  list_html += `<td class="proteome-id-td"><a href="${genome_record.up_id_url}" target="_blank">${genome_record.up_id}</a></td>`;
  list_html += `<td><a href="${assembly_url}" target="_blank">${genome_record.assembly}</a></td>`;
  list_html += '<td>' + genome_record.genome_taxid + '</td>';
  list_html += '<td class="genome_name">' + name + '</td>';
  list_html += '<td align="right">' + genome_record.n_genes.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  list_html += '<td align="right">' + genome_record.n_isoforms.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  list_html += '<td align="right">' + genome_record.cpd_label + '</td>';
  list_html += '<td align="right">' + genome_record.busco_complete + '</td>';
  list_html += '<td align="right">' + genome_record.busco_single + '</td>';
  list_html += '<td align="right">' + genome_record.busco_multi + '</td>';
  list_html += '<td align="right">' + genome_record.busco_fragmented + '</td>';
  list_html += '<td align="right">' + genome_record.busco_missing + '</td>';
  list_html += '</tr>';

  return list_html;
}
