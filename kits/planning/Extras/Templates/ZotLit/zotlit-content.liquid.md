{% capture keys %}{% for a in zt.annotations %}{% if a.colorName == "yellow" %}{% render "lititem" with a as zt %}{% endif %}{% endfor %}{% endcapture -%}
{% capture tries %}{% for a in zt.annotations %}{% if a.colorName == "green" %}{% render "lititem" with a as zt %}{% endif %}{% endfor %}{% endcapture -%}
{% capture qs %}{% for a in zt.annotations %}{% if a.colorName == "red" or a.colorName == "magenta" %}{% render "lititem" with a as zt %}{% endif %}{% endfor %}{% endcapture -%}
{% capture rest %}{% for a in zt.annotations %}{% unless a.colorName == "yellow" or a.colorName == "green" or a.colorName == "red" or a.colorName == "magenta" %}{% render "lititem" with a as zt %}{% endunless %}{% endfor %}{% endcapture -%}
{% capture related %}{% for r in zt.relatedItems %}{% if r.citekey %}[[{{ r.citekey }}]] {% endif %}{% endfor %}{% endcapture -%}
{% capture nl %}
{% endcapture -%}
{% if keys != "" %}
## Key points
{{ keys }}{% endif -%}
{% if tries != "" %}
## To try
{{ tries }}{% endif -%}
{% if qs != "" %}
## Questions
{{ qs }}{% endif -%}
{% if rest != "" %}
## Other highlights
{{ rest }}{% endif %}
> [!lab]- Used in experiments
> ```dataview
> LIST FROM "03 Lab Book/Notes"
> WHERE any(file.outlinks, (l) => meta(l).path = this.file.path)
> ```

> [!info]- Abstract & related
{% if zt.abstract -%}
> {{ zt.abstract | replace: nl, " " }}
{% endif -%}
{% if related != "" -%}
>
> **Related:** {{ related }}
{% endif -%}
