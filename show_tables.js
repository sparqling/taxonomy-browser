let haystack = [];
let currentTaxonName = null;
let scientificNameMap = {}; // Display name => Scientific name
let displayNameMap = {}; // Scientific name => Display name
let currentGenomeMap = {};


Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

function queryBySpang(queryUrl, param, callback, target_end = null) {
  spang.getTemplate(queryUrl, (query) => {
    spang.query(query, target_end ? target_end : endpoint, {param: param, format: 'json'}, (error, status, result) => {
      let resultJson;
      try {
        resultJson = JSON.parse(result);
      } catch (e) {
        console.log(e);
        resultJson = {
          results:
            {
              bindings: {}
            }
        };
      }
      callback(resultJson);
    });
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function init() {
  haystack = [];
  $.ajaxSetup({async: false});

  queryBySpang(`${sparql_dir}/get_taxa_as_candidates.rq`, {}, (data) => {
    scientificNameMap = {};
    for (let binding of data.results.bindings) {
      let entry = binding.name.value;
      if (binding.commonName?.value) {
        entry += ` (${binding.commonName.value})`;
        scientificNameMap[entry] = binding.name.value;
        displayNameMap[binding.name.value] = entry;
      }
      haystack.push(entry);
    }
  });

  $('#tags').focus();
}


$(function () {
  $('#tags').autocomplete({
    source: (request, response) => {
      response(
        $.grep(haystack, (value) => {
          let regexp = new RegExp('\\b' + escapeRegExp(request.term), 'i');
          return value.match(regexp);
        })
      );
    },
    autoFocus: true,
    delay: 100,
    minLength: 1,
    select: (e, ui) => {
      if (ui.item) {
        show_contents(ui.item['label']);
      }
    }
  });

  // Type slash to focus on the text box
  $(document).keyup((e) => {
    if ($(':focus').attr('id') !== 'tags' && e.keyCode === 191) {
      $('#tags').focus().seletc();
    }
  });

  $(document).keyup((e) => {
    if ($(':focus').attr('id') === 'tags' && e.keyCode === 13) {
      let taxon_name = $('#tags').val();
      if (taxon_name) {
        show_contents(taxon_name);
      }
    }
  });

  // Select a taxon name
  $('#taxonomy_div').on('mouseover', '.taxon_clickable', function (e) {
    $(this).css('background-color', '#e3e3e3');
    // $(this).siblings().css('background-color','#f5f5f5');
    $(this).siblings().css('background-color', '#f0f0f0');
  }).on('mouseout', '.taxon_clickable', function (e) {
    $(this).css('background-color', '#fff');
    $(this).siblings().css('background-color', '#fff');
  }).on('click', '.taxon_clickable', function (e) {
    let taxon_name = $(this).text();
    if (taxon_name) {
      $('#tags').val(displayNameMap[taxon_name] || taxon_name);
      show_contents(taxon_name);
      $('#tags').focus();
    }
  });

  // Select a taxonomic rank
  $('#taxonomy_div').on('mouseover', '.rank_clickable', function (e) {
    // $(this).parent().find('td').css('background-color','#f5f5f5');
    $(this).parent().find('td').css('background-color', '#f0f0f0');
    $(this).parent().find('td:nth-child(2)').css('background-color', '#e3e3e3');
  }).on('mouseout', '.rank_clickable', function (e) {
    $(this).parent().find('td').css('background-color', '#fff');
  }).on('click', '.rank_clickable', function (e) {
    let taxon_name = $(this).parent().find('td:nth-child(2)').text();
    if (taxon_name) {
      $('#tags').val(displayNameMap[taxon_name] || taxon_name);
      show_contents(taxon_name);
      $('#tags').focus();
    }
  });

  $(document).on('mouseover', '#details .genome_name', function (e) {
    $(this).parent().find('td').css('background-color', '#f0f0f0');
    $(this).css('background-color', '#e3e3e3');
  });
  $(document).on('mouseout', '#details .genome_name', function (e) {
    $(this).parent().find('td').css('background-color', '#fff');
  });

  // Manipulate the genome "cart"
  $(document).on('click', '.add_genome', function () {
    let this_row = $(this).closest('tr');
    // Selected item
    let proteome_id = this_row.find('td.proteome-id-td').text();
    // let orgname = this_row.find('td:nth-child(7)').text();

    if (localStorage.getItem(prefix + proteome_id)) {
      // Delete the item
      localStorage.removeItem(prefix + proteome_id);
    } else {
      // Add the item
      localStorage.setObject(prefix + proteome_id, currentGenomeMap[proteome_id]);
    }

    // Draw table
    show_selected_genome();
  });

  $(document).on('click', '.add_genome_all', function () {
    // Swith the icon
    let selected = $(this).prop("checked");
    $('.add_genome').each((i, each_checkbox) => {
      let each_row = $(each_checkbox).closest('tr');
      // Eech item
      let proteome_id = each_row.find('td.proteome-id-td').text();
      
      if (selected) {
        // Add the item
        if (!localStorage.getItem(prefix + proteome_id)) {
          localStorage.setItem(prefix + proteome_id, currentGenomeMap[proteome_id]);
        }
        $(each_checkbox).prop("checked", true);
      } else {
        // Delete the item
        if (localStorage.getItem(prefix + proteome_id)) {
          localStorage.removeItem(prefix + proteome_id);
        }
        $(each_checkbox).prop("checked", false);
      }
    });
    // Draw table
    show_selected_genome();
  });
});

function clear_tables() {
  $('#main_taxon_name_div').html('');
  $('#sub_title_div').html('');
  $('#taxonomy_div').html('');
  $('#dbpedia_div').html('');
  $('#genome_comparison_div').html('');
  $('#specific_genes_div').html('');
  $('#counter_div').html('');
  $('#details').attr('border', '0');
  $('#details').html('');
}

function show_contents(taxon_name, display_name = null, push_state = true) {
  display_name = display_name || taxon_name;
  taxon_name = scientificNameMap[taxon_name] || taxon_name;
  if (currentTaxonName === taxon_name)
    return;
  currentTaxonName = taxon_name;

  let genome_type = 'CompleteGenome';
  if ($('#draft').prop('checked')) {
    genome_type = 'Genome';
  }

  let lang = document.querySelector('#language-selector').value;

  // Get tax ID
  let taxid;
  let rank;

  if (push_state)
    history.pushState({taxon_name, display_name}, taxon_name, `?taxon_name=${taxon_name}&display_name=${display_name}`)

  queryBySpang(`${sparql_dir}/scientific_name_to_taxid.rq`, {taxon_name}, function (data) {
    data['results']['bindings'][0]['taxon']['value'].match(/(\d+)$/);
    taxid = RegExp.$1;
    rank = data['results']['bindings'][0]['rank']['value'].replace(/.*\//, '');

    // Show tables
    show_hierarchy(taxid, genome_type, lang);
    show_dbpedia(taxon_name, taxid, lang);
    show_genome_comparison(taxid);
    show_specific_genes(taxid);
    show_genome_list(rank, taxon_name, taxid, genome_type);
    $('#details').attr('border', '1');
    show_selected_genome();
    // Show main taxon name
    let html = `<h3><i>${taxon_name}</i> (Taxonomy ID: ${taxid})</h3>`;
    $('#main_taxon_name_div').html(html);
  });

  clear_tables();
}

function dbpedia_name(taxon_name) {
  if (taxon_name == 'Chania'
    || taxon_name == 'Nitrososphaeria'
    || taxon_name == 'Candidatus Korarchaeum cryptofilum') {
    return;
  } else if (taxon_name == 'Proteus') {
    return {name: 'Proteus_(bacterium)', uri: '<http://dbpedia.org/resource/Proteus_(bacterium)>'};
  } else if (taxon_name == 'Pan') {
    return {name: 'Pan_(genus)', uri: '<http://dbpedia.org/resource/Pan_(genus)>'};
  }

  let dbpedia_name = taxon_name
    .replace(/\s/g, '_')
    .replace(/^Candidatus_/, '')
    .replace(/\//g, '_')
    .replace(/'/g, '')
    .replace(/\(/g, '_').replace(/\)/g, '_')
    .replace(/\[/g, '').replace(/\]/g, '');

  return {name: dbpedia_name, uri: 'dbpedia:' + dbpedia_name};
}

function show_hierarchy(taxid, genome_type, lang) {
  let list = '';
  let table_upper = [];
  let table_lower = [];
  let table_sister = [];

  let upper_promise = new Promise((resolve, reject) => {
    queryBySpang(`${sparql_dir}/taxid_to_get_upper.rq`, {taxid}, function (data) {
      let data_p = data['results']['bindings'];
      for (let i = 0; i < data_p.length; i++) {
        table_upper[i] = data_p[i];
        let dbpedia = dbpedia_name(data_p[i]['label']['value']);
        if (dbpedia) {
          table_upper[i]['dbpedia'] = dbpedia.name;
          list += '( ' + dbpedia.uri + ' )';
        }
      }
      resolve();
    })
  });

  let lower_promise = new Promise((resolve, reject) => {
    queryBySpang(`${sparql_dir}/taxid_to_get_lower.rq`, {taxid}, function (data) {
      let data_p = data['results']['bindings'];
      for (let i = 0; i < data_p.length; i++) {
        table_lower[i] = data_p[i];
        let dbpedia = dbpedia_name(data_p[i]['label']['value']);
        if (dbpedia) {
          table_lower[i]['dbpedia'] = dbpedia.name;
          list += '( ' + dbpedia.uri + ' )';
        }
      }
      resolve();
    })
  });

  let sister_promise = new Promise((resolve, reject) => {
    queryBySpang(`${sparql_dir}/taxid_to_get_sisters.rq`, {taxid}, function (data) {
      let data_p = data['results']['bindings'];
      for (let i = 0; i < data_p.length; i++) {
        table_sister[i] = data_p[i];
        let dbpedia = dbpedia_name(data_p[i]['label']['value']);
        if (dbpedia) {
          table_sister[i]['dbpedia'] = dbpedia.name;
          list += '( ' + dbpedia.uri + ' )';
        }
      }
      resolve();
    })
  });

  // Use DBpedia to translate
  let dbpedia_labe_en = {};
  let dbpedia_labe_local = {};
  let local_promise = new Promise((resolve, reject) => {
    Promise.all([upper_promise, lower_promise, sister_promise]).then(() => {
      queryBySpang(`${sparql_dir}/taxid_to_get_local.rq`, {taxid: list, local_lang: lang}, function (data) {
        let data_p = data['results']['bindings'];
        for (let i = 0; i < data_p.length; i++) {
          let dbpedia_uri = data_p[i]['dbpedia_resource']['value'];
          if (data_p[i]['label_en']) {
            dbpedia_labe_en[dbpedia_uri] = data_p[i]['label_en']['value'];
          }
          if (data_p[i]['label_local'] && lang != 'en') {
            dbpedia_labe_local[dbpedia_uri] = data_p[i]['label_local']['value'];
          }
        }
        resolve();
      }, dbpedia_endpoint)
    });
  });

  let main_count = 0;
  local_promise.then(() => {
    // Show tables
    let html = '<table id="taxonomy" class="hierarchy" border="1">';
    html += '<tr><th colspan="3">Taxonomic hierarchy</th>';
    html += '<th align="center"><font size="2"><i>N</i></font></th></tr>';
    for (let i = 0; i < table_upper.length; i++) {
      let rank = table_upper[i]['rank']['value'].replace(/.*\//, '');
      let label = table_upper[i]['label']['value'];
      let wiki = '';
      if (table_upper[i]['dbpedia']) {
        let dbpedia_uri = 'http://dbpedia.org/resource/' + table_upper[i]['dbpedia'];
        if (dbpedia_labe_en[dbpedia_uri]) {
          wiki += '<a target="_blank" href="http://en.wikipedia.org/wiki/' + dbpedia_name(dbpedia_labe_en[dbpedia_uri]).name + '">*</a> ';
        }
        if (dbpedia_labe_local[dbpedia_uri] && lang != 'en') {
          let label_local = dbpedia_labe_local[dbpedia_uri];
          wiki += '<a target="_blank" href="http://' + lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
        }
      }
      label = '<td class="taxon_clickable" nowrap><i>' + label + '</i></td>';
      html += '<tr><td class="rank_clickable" nowrap>' +
        rank + '</td>' + label + '<td nowrap><font size="2">' + wiki + '</font></td>' +
        '<td align="right"><font size="2">' + table_upper[i]['count']['value'] + '</font></td></tr>';
    }

    for (let i = 0; i < table_sister.length; i++) {
      let rank = table_sister[i]['rank']['value'].replace(/.*\//, '');
      let sister_taxid = table_sister[i]['taxon']['value'].replace(/.*\//, '');
      let label = table_sister[i]['label']['value'];
      let sister_count = table_sister[i]['count']['value'];
      let wiki = '';
      if (table_sister[i]['dbpedia']) {
        let dbpedia_uri = 'http://dbpedia.org/resource/' + table_sister[i]['dbpedia'];
        if (dbpedia_labe_en[dbpedia_uri]) {
          wiki += '<a target="_blank" href="http://en.wikipedia.org/wiki/' + dbpedia_name(dbpedia_labe_en[dbpedia_uri]).name + '">*</a> ';
        }
        if (dbpedia_labe_local[dbpedia_uri] && lang != 'en') {
          let label_local = dbpedia_labe_local[dbpedia_uri];
          wiki += '<a target="_blank" href="http://' + lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
        }
      }
      let rank_orig = rank;
      if (sister_taxid == taxid) {
        rank = '<b>' + rank + '</b>';
      }
      let mark = '';
      if (sister_taxid == taxid) {
        mark = '-&ensp;';
      } else {
        mark = '+ ';
      }
      if (rank_orig == 'Superkingdom') {
      } else {
        mark = '&ensp;' + mark;
      }
      // if (rank_orig == 'Species') {
      //     // mark = '&emsp;&ensp;';
      //     mark = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      // }

      if (sister_taxid === taxid) {
        label = '<td nowrap><i><b>' + label + '</b></i></td>';
        html += '<tr bgcolor="#E3E3E3"><td nowrap>';
      } else {
        label = '<td class="taxon_clickable" nowrap><i>' + label + '</i></td>';
        html += '<tr><td class="rank_clickable" nowrap>';
      }
      html += mark + rank + '</td>' + label + '<td nowrap><font size="2">' + wiki + '</font></td>' +
        '<td align="right"><font size="2">' + sister_count + '</font></td>' + '</tr>';

      if (sister_taxid === taxid) {
        main_count = sister_count;
        for (let j = 0; j < table_lower.length; j++) {
          let rank = table_lower[j]['rank']['value'].replace(/.*\//, '');
          let label = table_lower[j]['label']['value'];
          let lower_count = table_lower[j]['count']['value'];
          let wiki = '';
          if (table_lower[j]['dbpedia']) {
            let dbpedia_uri = 'http://dbpedia.org/resource/' + table_lower[j]['dbpedia'];
            if (dbpedia_labe_en[dbpedia_uri]) {
              wiki += '<a target="_blank" href="http://en.wikipedia.org/wiki/' + dbpedia_name(dbpedia_labe_en[dbpedia_uri]).name + '">*</a> ';
            }
            if (dbpedia_labe_local[dbpedia_uri] && lang != 'en') {
              let label_local = dbpedia_labe_local[dbpedia_uri];
              wiki += '<a target="_blank" href="http://' + lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
            }
          }
          // if (rank == "Species" && rank_orig == "Genus") {
          rank = '&emsp;&emsp;&emsp;' + rank;
          // } else if (rank == "Superkingdom") {
          //     rank = '+ ' + rank;
          // } else {
          //     rank = '&emsp;&emsp;+ ' + rank;
          // }
          label = '<td class="taxon_clickable" nowrap><i>' + label + '</i></td>';
          html += '<tr><td class="rank_clickable" nowrap>' +
            rank + '</td>' + label + '<td nowrap><font size="2">' + wiki + '</font></td>' +
            '<td align="right"><font size="2">' + lower_count + '</font></td></tr>';
        }
      }
    }
    html += '</table>';

    $('#taxonomy_div').html(html);

    let count_unit = 'proteome';
    if (main_count >= 2) {
      count_unit = 'proteomes';
    }
    $('#sub_title_div').html(`<font size="2"><b>&emsp;Found ${main_count} ${count_unit}</b><br><br></font>`);
  });
}

function show_dbpedia(taxon_name, taxid, local_lang) {
  let dbpedia = dbpedia_name(taxon_name);
  if (!dbpedia) {
    return;
  }

  queryBySpang(`${sparql_dir}/dbpedia_entry.rq`, {
    entry: dbpedia.uri,
    lang_list: local_lang == 'en' ? '' : `("${local_lang}")`
  }, function (data) {
    let data_p = data['results']['bindings'];
    let img = '';
    let abst = '';
    let abst_local = '';
    let label_local = '';
    let wiki = '';
    for (let i = 0; i < data_p.length; i++) {
      if (!wiki) {
        wiki = data_p[i]['wiki']['value'];
      }
      if (!img && data_p[i]['image']) {
        img = data_p[i]['image']['value'];
      }
      if (!abst && data_p[i]['abst']['xml:lang'] == 'en') {
        abst = data_p[i]['abst']['value'];
        let max_len = 800;
        if (abst.length > max_len) {
          abst = abst.substr(0, max_len).replace(/\S+$/, '') + ' ...';
        }
      }
      if (!abst_local && data_p[i]['abst']['xml:lang'] == local_lang) {
        abst_local = data_p[i]['abst']['value'];
      }
      if (!label_local && data_p[i]['label']['xml:lang'] == local_lang) {
        label_local = data_p[i]['label']['value'];
      }
    }
    let html = '';
    if (wiki) {
      html += '<table id="dbpedia" border="1">';
      html += '<tr><td>';
      if (img) {
        html += '<a target="_blank" href="' + img + '"><img src="' + img + '?height=160" height="160"></a>';
      } else {
        html += '<font size="2">No image</font>';
      }
      html += '</td><td><font size="2">';
      html += abst;
      html += '<br>';
      html += '<a target="_blank" href="' + wiki + '">' + wiki + '</a>';
      if (local_lang != 'en') {
        html += '<br>';
        html += abst_local;
        html += '<br>';
        html += '<a target="_blank" href="http://' + local_lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
      }
      html += '</font></td>';
      html += '<td>';
      html += '<font size="2">Obtained from <a href="http://dbpedia.org">DBpedia</a></font>';
      html += '<br><br>';
      html += '<a href="http://creativecommons.org/licenses/by-sa/3.0/"><img src="img/cc-by-sa.png" width="62" height="22"></a>';
      html += '</td>';
      html += '</tr>';
      html += '</table>';
      $('#dbpedia_div').html(html);
    }
  }, dbpedia_endpoint);
}

function show_genome_comparison(taxid) {
  let mbgd_page = '/htbin/cluster_map?show_summary=on&map_type=cluster_size&tabid=';

  let count_compared = 0;
  queryBySpang(`${sparql_dir}/taxid_to_get_dataset.rq`, {taxid}, function (data) {
    let data_p = data['results']['bindings'];
    for (let i = 0; i < data_p.length; i++) {
      count_compared = data_p[i]['count']['value'];
    }
    if (count_compared) {
      let image = '';
      $.get('/images/cmprloc/tax' + taxid + '.findcore.cmprloc.png', function (data) {
        image = '<iframe width="100%" height=300 frameborder=0 ' +
          'src="http://mbgd.genome.ad.jp/stanza/showcmprloc.php?tabid=tax' + taxid + '">Cannnot see iframe on this browser</iframe><br>';
      });
      let html = '<font size="2">';
      if (image) {
        html += '&ensp;<b>Comparison of genomes</b>';
        html += '&ensp;(<a target="_blank" href="' + mbgd_page + 'tax' + taxid + '">selected ' + count_compared + ' representative genomes</a>)';
        html += image;
      } else {
        html += '<br>';
        html += '&ensp;<b>Genome comparison</b><br>';
        html += '&ensp;<a target="_blank" href="' + mbgd_page + 'tax' + taxid + '">compare ' + count_compared + ' representative genomes</a>';
        html += '<br><br>';
      }
      html += '</font>';
      $('#genome_comparison_div').html(html);
    }
  });
}

function show_specific_genes(taxid) {
  queryBySpang(`${sparql_dir}/taxon_to_default_orgs.rq`, {taxid}, function (data) {
    let data_p = data['results']['bindings'];
    let count_default = 0;
    for (let i = 0; i < data_p.length; i++) {
      count_default = data_p[i]['count']['value'];
    }
    if (count_default > 0) {
      let html = '';
      let mbgd_page = '/htbin/cluster_map?show_summary=on&map_type=cluster_size&tabid=';
      html += '<font size="2">';
      html += '&ensp;<b>Taxon specific genes</b>';
      html += '&ensp;(<a target="_blank" href="' + mbgd_page + 'default' + '">comparing ' + count_default;
      if (count_default == 1) {
        html += ' genome';
      } else {
        html += ' genomes';
      }
      html += ' in this Taxon vs Others</a>)';
      html += '<iframe width="100%" frameborder=0 marginheight="0" marginwidth="0" src="http://mbgd.genome.ad.jp:8101/stanza/taxon_to_specific_genes_in_dataset?' +
        'ortholog_dataset=default' + '&tax_id=' + taxid + '">Cannnot see iframe on this browser</iframe>';
      html += '</font>';
      $('#specific_genes_div').html(html);
    }
  });
}

function show_genome_list(rank, taxon_name, taxid, genome_type) {
  let count = 0;

  queryBySpang(`${sparql_dir}/taxon_to_search_genomes.rq`, {target_taxid: taxid}, function (data) {
    let data_p = data['results']['bindings'];
    count = data_p.length;

    let list_html = '';
    let count_reference = 0;
    currentGenomeMap = {};
    for (let i = 0; i < count; i++) {
      let row = data_p[i];
      
      row['taxid']['value'].match(/(\d+)$/);
      const genome_taxid = RegExp.$1;
      const up_id_url = row['proteome']['value'];
      const up_id = row['proteome']['value'].replace(/.*\//, '');
      const types = row['types']['value'];
      const organism_name = row['organism']['value'];
      const n_genes = parseInt(row['proteins']['value']);
      const n_isoforms = parseInt(row['isoforms']['value']);
      const cpd_label = row['cpd_label']['value'];
      const busco_complete = row['busco_complete'] ? row['busco_complete']['value'] : '';
      const busco_single = row['busco_single'] ? row['busco_single']['value'] : '';
      const busco_multi = row['busco_multi'] ? row['busco_multi']['value'] : '';
      const busco_fragmented = row['busco_fragmented'] ? row['busco_fragmented']['value'] : '';
      const busco_missing = row['busco_missing'] ? row['busco_missing']['value'] : '';
      const assembly = row['assembly'] ? row['assembly']['value'] : '';
      currentGenomeMap[up_id] = {
        genome_taxid,
        up_id_url,
        up_id,
        types,
        organism_name,
        n_genes,
        n_isoforms,
        cpd_label,
        busco_complete,
        busco_single,
        busco_multi,
        busco_fragmented,
        busco_missing,
        assembly
      };
      list_html += get_table_row(currentGenomeMap[up_id]);
      if (types.match(/Reference_Proteome/)) {
        count_reference++;
      }
    }

    let list_header = '<thead><tr>' +
      '<th align="center"><input type="checkbox" class="add_genome_all" title="Select all"></th>' +
      '<th>Ref</th>' +
      // '<th>Rep</th>' +
      '<th style="min-width: 6em">Proteome ID</th>' +
      '<th>Genome ID</th>' +
      '<th style="min-width: 3em">Tax ID</th>' +
      '<th>Species Name</th>' +
      '<th>Genes</th>' +
      '<th>Isoforms</th>' +
      '<th>CPD <a href="https://uniprot.org/help/assessing_proteomes" target="_blank">*</a></th>' +
      '<th>BUSCO</th>' +
      '<th class="thin">single</th>' +
      '<th class="thin">dupli.</th>' +
      '<th class="thin">frag.</th>' +
      '<th class="thin">miss.</th>' +
      '</tr></thead>';

    let count_unit = 'proteome';
    if (count >= 2) {
      count_unit = 'proteomes';
    }
    let reference_count_unit = 'reference proteome';
    if (count_reference >= 2) {
      reference_count_unit = 'reference proteomes';
    }
    let count_html = `<br><font size="2"><b><i>${taxon_name}</i>: ${count} ${count_unit}</b>`;
    count_html += ` (including <b>${count_reference}</b> ${reference_count_unit})</font>`;

    $('#details_div').html(count_html + '<label style="margin-left: 20px; margin-bottom: 10px">Filter by: </label><input id="detail-filter" data-column="all" type="search" style="margin-right: 30px;">' + 
      '<table border="1" id="details" class="tablesorter">' + list_header + list_html + '</table>');

    $('#details').tablesorter({
      headers: {
        0: {sorter: false},
        6: {sorter: 'fancyNumber'},
        7: {sorter: 'fancyNumber'}
      },
      widgetOptions : {
        filter_columnFilters: false,
        filter_external: '#detail-filter',
      },
      widgets: ["filter"],
    });

    let detailTable = $('#details');
    $.tablesorter.clearTableBody(detailTable[0]);
    detailTable.append(list_html).trigger('update');
  });

  return count;
}

function show_selected_genome() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      total++;
    }
  }

  let html = '<tr>' +
    '<td id="selected_genome_num"><font size="2">You selected <b>' + total + '</b> proteomes</font></td>' +
    '<td><a href="selected_genomes.html" target="_blank" class="btn">Check List</a></td>' +
    '<td width="5px"></td>' +
    '<td><input type="button" class="btn" style="font-size:13px;background:#c93a40" value="Clear" onClick="clearLocalStorage()"/>' +
    '<td width="5px"></td>' +
    '<td><input type="button" class="btn" style="font-size:13px;background:#707070" value="Default" onClick="setDefaultSpeciesList()"/>' +
    '<td width="5px"></td>' +
    '</tr>';
  $('#selected_genome').html(html);
  $('#selected_genome').css('background-color', '#d6d6d6');
}

function clearLocalStorage() {
  localStorage.clear();
  $('#details').find('img').attr('src', 'img/plus.png');
  show_selected_genome();
}

function setDefaultSpeciesList() {
  url = 'https://docs.google.com/spreadsheets/d/1-7FY-B_BpU72A045EeEuExea6FtMs8q-Urn9-R6-TWk/export?format=tsv';
  clearLocalStorage();
  fetch(url)
    .then(response => response.text())
    .then(text => {
      let values = text.split('\n').map(line => line.split('\t')[5])
        .filter(elem => elem.startsWith('prefix')).map(elem => `(proteome:${elem.slice(prefix.length)})`)
        .join(' ');
      queryBySpang(`${sparql_dir}/search_genomes_for_values.rq`, {values: values}, function (data) {
        const data_p = data['results']['bindings'];
        count = data_p.length;
        for (let i = 0; i < count; i++) {
          data_p[i]['taxid']['value'].match(/(\d+)$/);
          const genome_taxid = RegExp.$1;
          const up_id_url = data_p[i]['proteome']['value'];
          const up_id = data_p[i]['proteome']['value'].replace(/.*\//, '');
          const types = data_p[i]['types']['value'];
          const organism_name = data_p[i]['organism']['value'];
          const n_genes = parseInt(data_p[i]['proteins']['value']);
          const n_isoforms = parseInt(data_p[i]['isoforms']['value']);
          const cpd_label = data_p[i]['cpd_label']['value'];
          const busco_complete = data_p[i]['busco_complete'] ? data_p[i]['busco_complete']['value'] : '';
          const busco_single = data_p[i]['busco_single'] ? data_p[i]['busco_single']['value'] : '';
          const busco_multi = data_p[i]['busco_multi'] ? data_p[i]['busco_multi']['value'] : '';
          const busco_fragmented = data_p[i]['busco_fragmented'] ? data_p[i]['busco_fragmented']['value'] : '';
          const busco_missing = data_p[i]['busco_missing'] ? data_p[i]['busco_missing']['value'] : '';
          const assembly = data_p[i]['assembly'] ? data_p[i]['assembly']['value'] : '';
          saveInlocalStorage(up_id_url, up_id, types, organism_name, genome_taxid, n_genes, n_isoforms, cpd_label,
            busco_complete, busco_single, busco_multi, busco_fragmented, busco_missing, assembly);
        }
        show_selected_genome();
      });
    });
}

function saveInlocalStorage(up_id_url, up_id, types, organism_name, genome_taxid, n_genes, n_isoforms, cpd_label, busco_complete, busco_single, busco_multi, busco_fragmented, busco_missing, assembly) {
  let assembly_url = '';
  if (assembly) {
    assembly_url = 'https://ncbi.nlm.nih.gov/assembly/' + assembly;
  }

  let scientific_name = organism_name;
  let common_name = '';
  if (organism_name.match(/(.*)?(\(.*)/)) {
    scientific_name = RegExp.$1;
    common_name = RegExp.$2;
  }
  let name = `<i>${scientific_name}</i> ${common_name}`;

  let list_html = '<tr>';
  list_html += '<td align="center"><input type="checkbox" class="add_genome" title="Select"></td>';
  if (types.match(/Reference_Proteome/)) {
    list_html += '<td align="center"> &#9675 </td>';
  } else {
    list_html += '<td> </td>';
  }
  list_html += `<td><a href="${up_id_url}" target="_blank">${up_id}</a></td>`;
  list_html += `<td><a href="${assembly_url}" target="_blank">${assembly}</a></td>`;
  list_html += '<td>' + genome_taxid + '</td>';
  list_html += '<td class="genome_name">' + name + '</td>';
  list_html += '<td align="right">' + n_genes.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  list_html += '<td align="right">' + n_isoforms.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  list_html += '<td align="right">' + cpd_label + '</td>';
  list_html += '<td align="right">' + busco_complete + '</td>';
  list_html += '<td align="right">' + busco_single + '</td>';
  list_html += '<td align="right">' + busco_multi + '</td>';
  list_html += '<td align="right">' + busco_fragmented + '</td>';
  list_html += '<td align="right">' + busco_missing + '</td>';
  list_html += '</tr>';

  localStorage.setItem(up_id, list_html);
}

function load_url_state(push_state = true) {
  const urlParams = new URLSearchParams(window.location.search);
  let taxon_name = urlParams.get('taxon_name')
  if (taxon_name) {
    let display_name = urlParams.get('display_name')
    $('#tags').val(display_name || taxon_name);
    show_contents(taxon_name, display_name, push_state);
  } else {
    $('#tags').val('');
    currentTaxonName = null;
    clear_tables();
  }
}

$(() => {
  $.tablesorter.addParser({
    id: 'fancyNumber',
    is: function (s) {
      return /^[0-9]?[0-9,\.]*$/.test(s);
    },
    format: function (s) {
      return $.tablesorter.formatFloat(s.replace(/,/g, ''));
    },
    type: 'numeric'
  });

  let defaultLang = localStorage.getItem('language');
  defaultLang = defaultLang || ((navigator.languages && navigator.languages[0]) || navigator.language || navigator.userLanguage || navigator.browserLanguage).substr(0, 2);
  let defaultOption = document.querySelector(`.language-option[value="${defaultLang}"]`);
  if (defaultOption)
    defaultOption.selected = 'selected';

  $('#language-selector').on('change', (e) => {
    localStorage.setItem('language', e.target.value);
    currentTaxonName = null; // Forciblly reload current taxon
    load_url_state(false);
  });

  show_selected_genome();

  window.onpopstate = function (event) {
    load_url_state(false);
  }

  load_url_state();
});
