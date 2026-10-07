
> [!focus] Takeaway
> [takeaway:: ]

{% capture projlines %}{% for c in zt.collections %}{% if c.path.first == "Projects" and c.name != "Projects" %}> - [[{{ c.name }}]]: 
{% endif %}{% endfor %}{% endcapture -%}
> [!projects] For my projects
{% if projlines != "" %}{{ projlines }}{% else %}> - [[Project]]: 
{% endif %}
{% assign pdf = zt.attachments | where: "contentType", "application/pdf" | first -%}
`BUTTON[update-litnote]` {% if pdf %}[Open PDF]({{ pdf.backlink }}){% endif %}

{% render "content" with zt as zt %}

## My notes

