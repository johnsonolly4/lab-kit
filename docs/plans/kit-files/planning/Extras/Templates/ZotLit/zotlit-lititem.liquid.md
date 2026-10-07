{% capture nl %}
{% endcapture -%}
- {% if zt.imgLink %}{{ zt.imgLink | embed }} {% endif %}{% if zt.text %}{{ zt.text | replace: nl, " " }}{% endif %}{% if zt.comment %} — *{{ zt.comment | replace: nl, " " }}*{% endif %}{% if zt.tags.size > 0 %} {{ zt.tags | obsidian_tag: "#" | join: " " }}{% endif %} [p. {{ zt.pageLabel }}]({{ zt.backlink }}) ^{{ zt.key | downcase }}
