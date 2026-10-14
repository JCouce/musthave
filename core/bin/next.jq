# Entrada: status.json. $feats[0]: feature_list.json. Salida: id de la siguiente feature, ALL_GREEN o ALL_BLOCKED.
. as $st
| $feats[0] as $fl
| [ $fl[] | select(($st[.id].passes | not) and $st[.id].blocked_reason == null and all(.depends_on[]; $st[.].passes)) ]
| sort_by(.priority) as $ready
| if ($fl | all(.id as $i | $st[$i].passes)) then "ALL_GREEN"
  elif ($ready | length) > 0 then $ready[0].id
  else "ALL_BLOCKED" end
