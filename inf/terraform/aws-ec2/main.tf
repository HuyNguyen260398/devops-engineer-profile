module "ec2" {
  source = "github.com/HuyNguyen260398/dep-tf-modules//modules/aws/ec2?ref=main"

  name      = var.name
  subnet_id = var.subnet_id

  instance_type               = var.instance_type
  vpc_security_group_ids      = var.vpc_security_group_ids
  key_name                    = var.key_name
  associate_public_ip_address = var.associate_public_ip_address
  root_volume_size            = var.root_volume_size
  monitoring                  = var.monitoring
  create_eip                  = var.create_eip

  tags = local.common_tags
}
